/**
 * Spec Kit → HyperEdit Spielberg Bridge
 * Parses Spec Kit package directories and generates HyperEdit Spielberg commands.
 *
 * Usage: node scripts/spec-kit-to-hyperedit.js <spec-kit-dir> [output-dir]
 */

const fs = require("fs");
const path = require("path");

// ─── Parsers ─────────────────────────────────────────────────────────────────

/** Parse constitution.md into principles array */
function parseConstitution(markdown) {
  const principles = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const headingMatch = trimmed.match(/^###\s+([IVX]+\.)(.+)/);
    if (headingMatch) {
      const title = (headingMatch[1] + " " + headingMatch[2]).replace(/<!--.*?-->/g, "").trim();
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

/** Parse agent definition markdown */
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
    if (key === "role") { agent.role = content[0] ?? "Not specified"; }
    else if (key === "allowedactions") { agent.allowedActions = content; }
    else if (key === "forbiddenactions") { agent.forbiddenActions = content; }
    else if (key === "tools") { agent.tools = content; }
    else if (key === "memory") { agent.memory = content; }
    else if (key === "workflows") { agent.workflows = content; }
    else if (key === "proofrequirements") { agent.proofRequirements = content; }
  }

  return agent;
}

/** Parse workflow markdown */
function parseWorkflow(markdown) {
  const workflow = { trigger: "", steps: [] };
  const lines = markdown.split("\n");
  let stepNum = 0;

  for (const line of lines) {
    const triggerMatch = line.match(/^##\s*Trigger$/);
    if (triggerMatch) { workflow.trigger = lines[lines.indexOf(line) + 1]?.trim() ?? ""; }
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

/** Parse a complete Spec Kit package directory */
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
            // spec is in a subdirectory like 001-maintenance-triage-agent/
            for (const specFile of fs.readdirSync(specItemPath)) {
              const fp = path.join(specItemPath, specFile);
              if (!fs.statSync(fp).isFile()) continue;
              const content = fs.readFileSync(fp, "utf-8");
              if (specFile === "spec.md") result.spec = content;
              if (specFile === "plan.md") result.plan = content;
              if (specFile === "clarifications.md") result.clarifications = content;
              if (specFile === "tasks.md") result.tasks = content;
            }
          } else if (specItem.endsWith(".md")) {
            const content = fs.readFileSync(specItemPath, "utf-8");
            if (specItem === "spec.md") result.spec = content;
            if (specItem === "plan.md") result.plan = content;
          }
        }
      }
      if (file === "constitution") {
        const content = fs.readFileSync(
          path.join(fullPath, "constitution.md"), "utf-8"
        );
        result.constitution = parseConstitution(content);
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
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } else if (file === "constitution.md") {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (!result.constitution) {
        result.constitution = parseConstitution(content);
      }
    }
  }

  return result;
}

// ─── Spielberg Command Generator ──────────────────────────────────────────────

function generateDirectorCommands(parsed, outputDir) {
  const commands = [];
  let t = 0;

  // 1. Title card
  commands.push({
    type: "title_card", track: "V3", startTime: formatTime(t), duration: 4,
    text: "AI Agent Workforce", subtitle: "The Factory Is Open",
    template: "AnimatedText",
    style: { fontFamily: "Inter", fontWeight: 700, fontSize: 64, color: "#FFFFFF", accentColor: "#00D4FF", background: "#0A0A0F" },
  });
  t += 5;

  // 2. Constitution principles
  if (parsed.constitution?.principles) {
    for (const p of parsed.constitution.principles.slice(0, 6)) {
      commands.push({
        type: "principle_card", track: "V2", startTime: formatTime(t), duration: 6,
        title: p.title, description: truncate(p.description, 150),
        template: "LowerThird",
        style: { titleColor: "#00D4FF", descColor: "#B0B0B0", bgColor: "#1A1A24" },
      });
      t += 7;
    }
  }

  // 3. Agent cards
  for (const agent of parsed.agents) {
    commands.push({
      type: "agent_card", track: "V2", startTime: formatTime(t), duration: 8,
      agentName: agent.name, role: agent.role ?? "Operator",
      allowedActions: (agent.allowedActions ?? []).slice(0, 4),
      tools: (agent.tools ?? []).slice(0, 3),
      proofCount: (agent.proofRequirements ?? []).length,
      template: "DataChart",
      style: { cardBg: "#1A1A24", accentBorder: "#00D4FF", textColor: "#FFFFFF" },
    });
    t += 9;
  }

  // 4. Workflow steps
  for (const wf of parsed.workflows) {
    for (let i = 0; i < Math.min(wf.steps.length, 8); i++) {
      const step = wf.steps[i];
      commands.push({
        type: "step_card", track: "V2", startTime: formatTime(t), duration: 5,
        stepNumber: step.stepNumber ?? (i + 1), totalSteps: wf.steps.length,
        stepName: step.title, description: step.description ?? "",
        template: "ProgressBar",
        style: { progressColor: "#00FF88", trackColor: "#333340", textColor: "#FFFFFF" },
      });
      t += 6;
    }
  }

  // 5. CTA end card
  commands.push({
    type: "cta_card", track: "V3", startTime: formatTime(t), duration: 6,
    title: "The Factory Is Open", subtitle: "Baseline Studios × Spec Kit",
    template: "CallToAction",
    style: { titleColor: "#FFFFFF", subtitleColor: "#00D4FF", buttonColor: "#00D4FF", buttonText: "Get Started", background: "#0A0A0F" },
  });

  return commands;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node scripts/spec-kit-to-hyperedit.js <spec-kit-package-dir> [output-dir]");
  process.exit(1);
}

const specDir = path.resolve(args[0]);
const outDir = path.resolve(args[1] || "./spec-kit-video-output");

console.log("Parsing:", specDir);
const parsed = parseSpecKitPackage(specDir);

console.log("Found:", {
  principles: parsed.constitution?.principles?.length ?? 0,
  spec: parsed.spec ? "yes" : "no",
  agents: parsed.agents.length,
  workflows: parsed.workflows.length,
});

const commands = generateDirectorCommands(parsed);
console.log("Generated", commands.length, "Spielberg commands");
commands.forEach((c, i) => {
  console.log(`  ${i + 1}. [${c.type}] → ${c.track} at ${c.startTime} (${c.duration}s)`);
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "spielberg-commands.json"), JSON.stringify(commands, null, 2));
fs.writeFileSync(path.join(outDir, "parsed-package.json"), JSON.stringify(parsed, null, 2));

console.log("→ " + outDir + "/spielberg-commands.json");
console.log("→ " + outDir + "/parsed-package.json");
