/**
 * Director Command → Remotion Scene Converter
 * 
 * Transforms Spec Kit bridge "director commands" into Remotion-compatible scene
 * objects that DynamicAnimation.tsx can render via npx remotion render.
 * 
 * Usage:
 *   node scripts/director-to-remotion.js <director-commands.json> <output-scenes.json>
 * 
 * Or programmatically (requires director-commands.json path as first arg):
 *   node scripts/director-to-remotion.js /path/to/director-commands.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FPS = 30;

// Scene type mappings: Director command type → Remotion scene type
const TYPE_MAP = {
  title_card: "title",
  principle_card: "text",
  agent_card: "features",
  step_card: "steps",
  cta_card: "title",
  stats_card: "stats",
};

/**
 * Convert a single director command to a Remotion scene
 */
function commandToScene(cmd, index) {
  const remotionType = TYPE_MAP[cmd.type] || "title";
  const durationFrames = Math.round((cmd.duration || 4) * FPS);
  const style = cmd.style || {};

  let content = {};

  switch (cmd.type) {
    case "title_card":
      content = {
        title: cmd.text || "Title",
        subtitle: cmd.subtitle || "",
        color: style.color || "#ffffff",
        backgroundColor: style.background || "#0a0a0f",
      };
      break;

    case "principle_card":
      content = {
        title: cmd.title || "Principle",
        subtitle: cmd.description || "",
        color: style.titleColor || "#00d4ff",
        backgroundColor: style.bgColor || "#1a1a24",
      };
      break;

    case "agent_card": {
      // Build items array from agent data
      const items = [];

      // Role as first item
      if (cmd.role) {
        items.push({
          label: "Role",
          description: cmd.role,
          icon: "🤖",
        });
      }

      // Allowed actions (limited to show first 4)
      const actions = (cmd.allowedActions || []).slice(0, 4);
      if (actions.length > 0) {
        items.push({
          label: `Actions (${actions.length})`,
          description: actions.join(" • "),
          icon: "✅",
        });
      }

      // Tools
      const tools = (cmd.tools || []).slice(0, 4);
      if (tools.length > 0) {
        items.push({
          label: `Tools (${tools.length})`,
          description: tools.join(" • "),
          icon: "🔧",
        });
      }

      // Proof requirements count
      if (cmd.proofCount > 0) {
        items.push({
          label: "Proof Requirements",
          description: `${cmd.proofCount} verification(s) required`,
          icon: "🎯",
        });
      }

      content = {
        title: cmd.agentName || "Agent",
        items,
        color: style.textColor || "#ffffff",
        backgroundColor: style.cardBg || "#1a1a24",
      };
      break;
    }

    case "step_card": {
      // Group steps into a single scene for the whole workflow step
      const progressPercent = Math.round(
        ((cmd.stepNumber || 1) / (cmd.totalSteps || 1)) * 100
      );

      content = {
        title: `Step ${cmd.stepNumber || 1}: ${cmd.stepName || ""}`,
        subtitle: cmd.description || "",
        items: [
          {
            label: `Progress`,
            value: progressPercent,
            description: `Step ${cmd.stepNumber || 1} of ${cmd.totalSteps || 1}`,
          },
        ],
        color: style.textColor || "#ffffff",
        backgroundColor: "#0a0a0f",
      };
      break;
    }

    case "cta_card":
      content = {
        title: cmd.title || "Call to Action",
        subtitle: cmd.subtitle || "",
        color: style.titleColor || "#ffffff",
        backgroundColor: style.background || "#0a0a0f",
      };
      break;

    default:
      // Fallback: treat as title scene
      content = {
        title: cmd.text || cmd.title || cmd.agentName || "Scene",
        subtitle:
          cmd.subtitle ||
          cmd.description ||
          cmd.role ||
          "",
        color: style.color || style.textColor || "#ffffff",
        backgroundColor:
          style.background || style.bgColor || style.cardBg || "#0a0a0f",
      };
  }

  // Build transition
  const transition = {
    type: "fade",
    duration: 10, // ~0.33s at 30fps
  };

  return {
    id: `scene-${index}`,
    type: remotionType,
    duration: durationFrames,
    content,
    transition,
  };
}

/**
 * Convert entire director commands array to Remotion scenes
 */
function convertToRemotionScenes(directorCommands) {
  const scenes = directorCommands.map((cmd, index) => commandToScene(cmd, index));

  return {
    scenes,
    backgroundColor: "#0a0a0f",
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
  };
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(
    "Usage: node scripts/director-to-remotion.js <director-commands.json> [output-scenes.json]"
  );
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(
  args[1] || inputPath.replace("director-commands.json", "remotion-scenes.json")
);

console.log("Reading director commands:", inputPath);
const directorCommands = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

console.log("Converting", directorCommands.length, "commands to Remotion scenes...");
const remotionResult = convertToRemotionScenes(directorCommands);

console.log("Generated", remotionResult.scenes.length, "scenes");
console.log(
  "Total duration:",
  remotionResult.totalDuration,
  "frames (" + (remotionResult.totalDuration / 30).toFixed(1) + "s)"
);

remotionResult.scenes.forEach((scene, i) => {
  console.log(
    `  ${i + 1}. [${scene.type}] "${scene.content.title}" — ${scene.duration} frames (${(scene.duration / 30).toFixed(1)}s)`
  );
});

// Write output
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(remotionResult, null, 2));
console.log("\n→", outputPath);
console.log(
  "\nRender with:",
  `npx remotion render src/remotion/index.tsx DynamicAnimation ./output.mp4 --props="${outputPath}"`
);
