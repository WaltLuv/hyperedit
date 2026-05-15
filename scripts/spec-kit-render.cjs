/**
 * Spec Kit → HyperEdit Render Bridge
 *
 * Takes a SpecKit package directory, parses its markdown, generates
 * director commands, writes Remotion props JSON, and invokes the Remotion
 * CLI to render a full 1080p video.
 *
 * Usage (called by local-ffmpeg-server.js):
 *   node scripts/spec-kit-render.js <spec-kit-dir> <output-mp4-path>
 *
 * Output:
 *   - <output-mp4-path> : final rendered video
 *   - <output-mp4-path>.props.json : Remotion props used (for re-render/edit)
 *   - <output-mp4-path>.commands.json : director commands (for reference)
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Parsers (same as spec-kit-to-hyperedit.cjs) ─────────────────────────────

function parseConstitution(markdown) {
  const principles = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const headingMatch = trimmed.match(/^###\s+([IVX]+\.)(.+)/);
    if (headingMatch) {
      const title = (headingMatch[1] + " " + headingMatch[2])
        .replace(/<!--.*?-->/g, "")
        .trim();
      i++;
      const descLines = [];
      while (i < lines.length) {
        const innerTrimmed = lines[i].trim();
        if (innerTrimmed.startsWith("###") || innerTrimmed.startsWith("## ")) break;
        if (innerTrimmed && !innerTrimmed.startsWith("<!--")) descLines.push(innerTrimmed);
        i++;
      }
      principles.push({ title, description: descLines.join(" ") });
      continue;
    }
    i++;
  }
  return { type: "constitution", principles };
}

function parseAgentDefinition(fileContent) {
  const agent = {};
  const headingMatch = fileContent.match(/^#\s+(.+)/m);
  agent.name = headingMatch ? headingMatch[1].trim() : "Agent";

  const sections = fileContent.split(/^##\s+/m);
  for (const section of sections) {
    const [title, ...rest] = section.split("\n");
    if (!title) continue;
    const content = rest
      .filter((l) => l.trim())
      .map((l) => l.replace(/^[-*]\s+/, "").trim());
    const key = title.trim().toLowerCase().replace(/\s+/g, "");
    if (key === "role") agent.role = content[0] ?? "Not specified";
    else if (key === "allowedactions") agent.allowedActions = content;
    else if (key === "forbiddenactions") agent.forbiddenActions = content;
    else if (key === "tools") agent.tools = content;
    else if (key === "memory") agent.memory = content;
    else if (key === "workflows") agent.workflows = content;
    else if (key === "proofrequirements") agent.proofRequirements = content;
  }
  return agent;
}

function parseWorkflow(markdown) {
  const workflow = { trigger: "", steps: [], name: "" };
  const lines = markdown.split("\n");
  let stepNum = 0;

  // Extract workflow name from first # heading
  const nameMatch = markdown.match(/^#\s+(.+)/m);
  if (nameMatch) workflow.name = nameMatch[1].trim();

  for (const line of lines) {
    const triggerMatch = line.match(/^##\s*Trigger$/);
    if (triggerMatch) {
      const idx = lines.indexOf(line);
      workflow.trigger = lines[idx + 1]?.trim() ?? "";
    }
    const stepMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*(.*)?$/);
    if (stepMatch) {
      stepNum++;
      workflow.steps.push({
        stepNumber: stepNum,
        title: stepMatch[1],
        description: stepMatch[2] ? stepMatch[2].replace(/^—\s*/, "").trim() : "",
      });
    }
  }
  return workflow;
}

function parseSpecKitPackage(packageDir) {
  const result = {
    constitution: null,
    spec: null,
    agents: [],
    workflows: [],
    skillManifest: null,
    agentManifest: null,
    workflowManifest: null,
  };

  const files = fs.readdirSync(packageDir);

  for (const file of files) {
    const fullPath = path.join(packageDir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file === "specs") {
        const specItems = fs.readdirSync(fullPath);
        for (const specItem of specItems) {
          const specItemPath = path.join(fullPath, specItem);
          if (fs.statSync(specItemPath).isDirectory()) {
            for (const specFile of fs.readdirSync(specItemPath)) {
              const fp = path.join(specItemPath, specFile);
              if (!fs.statSync(fp).isFile()) continue;
              const content = fs.readFileSync(fp, "utf-8");
              if (specFile === "spec.md") result.spec = content;
              if (specFile === "plan.md") result.plan = content;
            }
          } else if (specItem.endsWith(".md")) {
            const content = fs.readFileSync(specItemPath, "utf-8");
            if (specItem === "spec.md") result.spec = content;
          }
        }
      }
      if (file === "constitution") {
        const constPath = path.join(fullPath, "constitution.md");
        if (fs.existsSync(constPath)) {
          result.constitution = parseConstitution(fs.readFileSync(constPath, "utf-8"));
        }
      }
      if (file === "agents") {
        for (const agentFile of fs.readdirSync(fullPath)) {
          const content = fs.readFileSync(path.join(fullPath, agentFile), "utf-8");
          result.agents.push(parseAgentDefinition(content));
        }
      }
      if (file === "workflows") {
        for (const wfFile of fs.readdirSync(fullPath)) {
          const content = fs.readFileSync(path.join(fullPath, wfFile), "utf-8");
          result.workflows.push(parseWorkflow(content));
        }
      }
      if (file === "marketplace") {
        for (const mf of fs.readdirSync(fullPath)) {
          const fp = path.join(fullPath, mf);
          if (mf.endsWith(".json")) {
            try {
              const manifest = JSON.parse(fs.readFileSync(fp, "utf-8"));
              if (mf.includes("skill")) result.skillManifest = manifest;
              if (mf.includes("agent")) result.agentManifest = manifest;
              if (mf.includes("workflow")) result.workflowManifest = manifest;
            } catch { /* ignore */ }
          }
        }
      }
    } else if (file === "constitution.md") {
      if (!result.constitution) {
        result.constitution = parseConstitution(fs.readFileSync(fullPath, "utf-8"));
      }
    }
  }
  return result;
}

// ─── Director Command Generator ──────────────────────────────────────────────

function generateDirectorCommands(parsed, options = {}) {
  const commands = [];
  let t = 0;
  const maxPrincipleCards = options.maxPrinciples ?? 6;

  // 1. Title card
  commands.push({
    type: "title_card",
    startTime: formatTime(t),
    duration: 4,
    text: options.title || "AI Agent Workforce",
    subtitle: options.subtitle || "The Factory Is Open",
    style: { accentColor: options.accentColor || "#00D4FF" },
  });
  t += 5;

  // 2. Constitution principles (cap at maxPrincipleCards to avoid enormous videos)
  if (parsed.constitution?.principles) {
    const principles = parsed.constitution.principles.slice(0, maxPrincipleCards);
    for (const p of principles) {
      commands.push({
        type: "principle_card",
        startTime: formatTime(t),
        duration: 6,
        title: p.title,
        description: truncate(p.description, 150),
        style: { titleColor: options.accentColor || "#00D4FF", descColor: "#B0B0B0" },
      });
      t += 7;
    }
  }

  // 3. Agent cards
  for (const agent of parsed.agents) {
    commands.push({
      type: "agent_card",
      startTime: formatTime(t),
      duration: 8,
      agentName: agent.name,
      role: agent.role ?? "Operator",
      allowedActions: (agent.allowedActions ?? []).slice(0, 4),
      tools: (agent.tools ?? []).slice(0, 3),
      proofCount: (agent.proofRequirements ?? []).length,
      style: { accentBorder: options.accentColor || "#00D4FF" },
    });
    t += 9;
  }

  // 4. Workflow steps (cap each workflow at 6 steps)
  for (const wf of parsed.workflows) {
    if (wf.steps.length === 0) continue;
    for (let i = 0; i < Math.min(wf.steps.length, 6); i++) {
      const step = wf.steps[i];
      commands.push({
        type: "step_card",
        startTime: formatTime(t),
        duration: 5,
        workflowName: wf.name || "Workflow",
        stepNumber: step.stepNumber ?? (i + 1),
        totalSteps: wf.steps.length,
        stepName: step.title,
        description: step.description ?? "",
        stepTrigger: wf.trigger ?? "",
        style: { progressColor: "#00FF88" },
      });
      t += 6;
    }
  }

  // 5. CTA end card
  commands.push({
    type: "cta_card",
    startTime: formatTime(t),
    duration: 6,
    title: options.ctaTitle || "The Factory Is Open",
    subtitle: options.ctaSubtitle || "Baseline Studios × Spec Kit",
    style: { buttonColor: options.accentColor || "#00D4FF" },
  });

  return commands;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

// ─── Remotion Props Generator ────────────────────────────────────────────────

function generateRemotionProps(commands, options = {}) {
  // Add id field to each scene for Remotion Sequence keys
  return {
    scenes: commands.map((cmd, idx) => ({ id: `scene-${idx}`, ...cmd })),
    accentColor: options.accentColor || "#00D4FF",
    backgroundColor: options.backgroundColor || "#0A0A0F",
    title: options.title || "AI Agent Workforce",
    subtitle: options.subtitle || "The Factory Is Open",
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node spec-kit-render.js <spec-kit-dir> <output-mp4> [--options]");
    process.exit(1);
  }

  const specDir = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);
  const propsPath = outputPath + ".props.json";
  const commandsPath = outputPath + ".commands.json";

  // Parse optional flags
  const opts = {
    maxPrinciples: 6,
    accentColor: "#00D4FF",
    backgroundColor: "#0A0A0F",
    title: "AI Agent Workforce",
    subtitle: "The Factory Is Open",
    ctaTitle: "The Factory Is Open",
    ctaSubtitle: "Baseline Studios × Spec Kit",
  };
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--max-principles" && args[i + 1]) { opts.maxPrinciples = parseInt(args[++i], 10); }
    if (args[i] === "--accent" && args[i + 1]) { opts.accentColor = args[++i]; }
    if (args[i] === "--bg" && args[i + 1]) { opts.backgroundColor = args[++i]; }
    if (args[i] === "--title" && args[i + 1]) { opts.title = args[++i]; }
    if (args[i] === "--subtitle" && args[i + 1]) { opts.subtitle = args[++i]; }
  }

  console.log(`[spec-kit-render] Parsing: ${specDir}`);
  const parsed = parseSpecKitPackage(specDir);

  console.log(`[spec-kit-render] Found:`, {
    principles: parsed.constitution?.principles?.length ?? 0,
    agents: parsed.agents.length,
    workflows: parsed.workflows.length,
    hasSpec: !!parsed.spec,
  });

  // Generate director commands
  const commands = generateDirectorCommands(parsed, opts);
  console.log(`[spec-kit-render] Generated ${commands.length} Director commands`);

  // Generate Remotion props
  const remotionProps = generateRemotionProps(commands, opts);

  // Write props JSON
  fs.writeFileSync(propsPath, JSON.stringify(remotionProps, null, 2));
  fs.writeFileSync(commandsPath, JSON.stringify(commands, null, 2));
  console.log(`[spec-kit-render] Props → ${propsPath}`);
  console.log(`[spec-kit-render] Commands → ${commandsPath}`);

  // Determine hyperedit root (parent of scripts/ dir)
  const hypereditRoot = path.resolve(__dirname, "..");

  // Invoke Remotion CLI to render
  // npx remotion render src/remotion/index.tsx SpecKitVideo <output> --props <props.json>
  const remotionArgs = [
    "remotion", "render",
    "src/remotion/index.tsx",
    "SpecKitVideo",
    outputPath,
    "--props", propsPath,
    "--codec", "h264",
    "--overwrite",
    "--gl=angle",
  ];

  console.log(`[spec-kit-render] Rendering with Remotion: npx ${remotionArgs.join(" ")}`);

  await new Promise((resolve, reject) => {
    const proc = spawn("npx", remotionArgs, {
      cwd: hypereditRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => process.stdout.write(`[remotion] ${d}`));
    proc.stderr.on("data", (d) => process.stderr.write(`[remotion] ${d}`));

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`[spec-kit-render] Render complete → ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`Remotion render failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

main().catch((err) => {
  console.error("[spec-kit-render] ERROR:", err.message);
  process.exit(1);
});
