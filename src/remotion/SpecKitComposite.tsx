import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, useVideoConfig, spring } from "remotion";
import React from "react";

// SpecKit Remotion Composite
// Renders Spec Kit package content as animated video scenes
// Used by HyperEdit FFmpeg server to generate video from Spec Kit output

// ─── Title Scene ─────────────────────────────────────────────────────────────

export const TitleScene: React.FC<{
  text?: string;
  subtitle?: string;
  accentColor?: string;
}> = ({ text = "AI Agent Workforce", subtitle = "The Factory Is Open", accentColor = "#00D4FF" }) => {
  const frame = useCurrentFrame();
  const vidConfig = useVideoConfig();

  const textOpacity = spring({ frame, fps: vidConfig.fps, config: { damping: 20 } });
  const textY = interpolate(textOpacity, [0, 1], [60, 0]);
  const subtitleDelay = 20;
  const subtitleOpacity = spring({ frame: Math.max(0, frame - subtitleDelay), fps: vidConfig.fps });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0F", justifyContent: "center", alignItems: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", opacity: textOpacity, transform: `translateY(${textY}px)` }}>
        <h1 style={{ fontSize: 72, fontWeight: 800, color: "#FFFFFF", margin: 0, letterSpacing: "-2px" }}>
          {text}
        </h1>
        <div style={{ width: 120, height: 4, background: `linear-gradient(90deg, ${accentColor}, #00FF88)`, margin: "24px auto", borderRadius: 2 }} />
        <p style={{ fontSize: 24, fontWeight: 400, color: accentColor, margin: 0, opacity: subtitleOpacity }}>
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ─── Principle Card Scene ────────────────────────────────────────────────────

export const PrincipleScene: React.FC<{
  title?: string;
  description?: string;
  principleNumber?: number;
  totalPrinciples?: number;
  accentColor?: string;
}> = ({ title, description, principleNumber = 1, totalPrinciples = 14, accentColor = "#00D4FF" }) => {
  const frame = useCurrentFrame();
  const vidConfig = useVideoConfig();

  const progress = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleSlideIn = spring({ frame: Math.max(0, frame - 5), fps: vidConfig.fps, config: { damping: 15 } });
  const descFadeIn = spring({ frame: Math.max(0, frame - 12), fps: vidConfig.fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1A1A24", padding: 60, fontFamily: "Inter, sans-serif" }}>
      {/* Progress bar */}
      <div style={{ width: "100%", height: 6, backgroundColor: "#333340", borderRadius: 3, marginBottom: 40 }}>
        <div style={{ width: `${(principleNumber / totalPrinciples) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${accentColor}, #00FF88)`, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>

      {/* Principle number */}
      <div style={{ fontSize: 16, fontWeight: 600, color: accentColor, marginBottom: 12 }}>
        PRINCIPLE {principleNumber} OF {totalPrinciples}
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 42, fontWeight: 700, color: "#FFFFFF", margin: 0, opacity: titleSlideIn, transform: `translateY(${interpolate(titleSlideIn, [0, 1], [30, 0])}px)` }}>
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p style={{ fontSize: 20, fontWeight: 300, color: "#B0B0B0", marginTop: 24, lineHeight: 1.7, maxWidth: 900, opacity: descFadeIn }}>
          {description}
        </p>
      )}
    </AbsoluteFill>
  );
};

// ─── Agent Card Scene ────────────────────────────────────────────────────────

export const AgentScene: React.FC<{
  agentName?: string;
  role?: string;
  allowedActions?: string[];
  tools?: string[];
  proofCount?: number;
  accentColor?: string;
}> = ({ agentName = "Agent", role = "Operator", allowedActions = [], tools = [], proofCount = 0, accentColor = "#00D4FF" }) => {
  const frame = useCurrentFrame();
  const vidConfig = useVideoConfig();

  const slideIn = spring({ frame, fps: vidConfig.fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1A1A24", padding: 60, fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 900, opacity: slideIn, transform: `translateX(${interpolate(slideIn, [0, 1], [80, 0])}px)` }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${accentColor}, #006666)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            🤖
          </div>
          <div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>{agentName}</h2>
            <p style={{ fontSize: 18, fontWeight: 400, color: accentColor, margin: 0 }}>{role}</p>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 28 }}>
          {/* Allowed Actions */}
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", marginBottom: 10 }}>ALLOWED ACTIONS</h4>
            {allowedActions.slice(0, 6).map((action, i) => (
              <p key={i} style={{ fontSize: 14, color: "#00D4FF", margin: 0, marginBottom: 6 }}>✓ {action}</p>
            ))}
          </div>

          {/* Tools */}
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", marginBottom: 10 }}>TOOLS ({tools.length})</h4>
            {tools.slice(0, 6).map((tool, i) => (
              <p key={i} style={{ fontSize: 14, color: "#00FF88", margin: 0, marginBottom: 6 }}>⚡ {tool}</p>
            ))}
          </div>
        </div>

        {/* Proof badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", backgroundColor: "#333340", borderRadius: 8 }}>
          <span style={{ color: "#00FF88", fontSize: 16 }}>✓</span>
          <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 500 }}>{proofCount} proof requirements defined</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Workflow Step Scene ─────────────────────────────────────────────────────

export const WorkflowScene: React.FC<{
  workflowName?: string;
  stepNumber?: number;
  totalSteps?: number;
  stepName?: string;
  stepDescription?: string;
  stepTrigger?: string;
  accentColor?: string;
}> = ({ workflowName, stepNumber = 1, totalSteps = 1, stepName, stepDescription = "", stepTrigger = "", accentColor = "#00FF88" }) => {
  const frame = useCurrentFrame();
  const vidConfig = useVideoConfig();

  const titleSlide = spring({ frame: Math.max(0, frame - 3), fps: vidConfig.fps });
  const stepSlide = spring({ frame: Math.max(0, frame - 10), fps: vidConfig.fps });
  const descSlide = spring({ frame: Math.max(0, frame - 18), fps: vidConfig.fps });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1A1A24", padding: 60, fontFamily: "Inter, sans-serif" }}>
      {/* Workflow name */}
      <div style={{ opacity: titleSlide, transform: `translateY(${interpolate(titleSlide, [0, 1], [20, 0])}px)` }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#00D4FF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 2 }}>
          {workflowName}
        </div>
        <div style={{ width: "100%", height: 4, backgroundColor: "#333340", borderRadius: 2, marginBottom: 40 }} />
      </div>

      {/* Step content */}
      <div style={{ opacity: stepSlide, transform: `translateY(${interpolate(stepSlide, [0, 1], [30, 0])}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", backgroundColor: accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#0A0A0F" }}>{stepNumber}</span>
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
            {stepName}
          </h2>
        </div>

        {!stepSlide && (
          <>
            {/* Description */}
            {stepDescription && (
              <p style={{ fontSize: 20, color: "#B0B0B0", marginTop: 20, lineHeight: 1.6, opacity: descSlide }}>
                {stepDescription}
              </p>
            )}

            {/* Trigger */}
            {stepTrigger && (
              <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", backgroundColor: "#333340", borderRadius: 8 }}>
                <span style={{ color: "#FFB800", fontSize: 16 }}>⚡</span>
                <span style={{ color: "#FFFFFF", fontSize: 14 }}>TRIGGER: {stepTrigger}</span>
              </div>
            )}
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── CTA Scene ───────────────────────────────────────────────────────────────

export const CTAScene: React.FC<{
  title?: string;
  subtitle?: string;
  accentColor?: string;
}> = ({ title = "The Factory Is Open", subtitle = "Baseline Studios × Spec Kit", accentColor = "#00D4FF" }) => {
  const frame = useCurrentFrame();
  const vidConfig = useVideoConfig();

  const titleOpacity = spring({ frame, fps: vidConfig.fps, config: { damping: 15 } });
  const subtitleOpacity = spring({ frame: Math.max(0, frame - 20), fps: vidConfig.fps });
  const lineExpand = interpolate(frame, [0, 40], [0, 120], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0F", justifyContent: "center", alignItems: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", opacity: titleOpacity, transform: `translateY(${interpolate(titleOpacity, [0, 1], [40, 0])}px)` }}>
        <h1 style={{ fontSize: 72, fontWeight: 800, color: "#FFFFFF", margin: 0, letterSpacing: "-2px" }}>
          {title}
        </h1>
        <div style={{ width: lineExpand, height: 4, background: `linear-gradient(90deg, ${accentColor}, #00FF88)`, margin: "24px auto", borderRadius: 2 }} />
        <p style={{ fontSize: 24, color: "#B0B0B0", margin: 0, opacity: subtitleOpacity }}>
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────────────────

export const SpecKitComposite: React.FC<{
  directorCommands?: Array<Record<string, any>>;
  frameRate?: number;
}> = ({ directorCommands = [], frameRate = 30 }) => {
  return (
    <>
      {directorCommands.map((cmd, index) => {
        const timeParts = (cmd.startTime as string).split(":");
        const startFrame = (parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])) * frameRate;
        const durationFrames = (cmd.duration as number) * frameRate;

        return (
          <Sequence from={startFrame} durationInFrames={durationFrames} key={index}>
            {cmd.type === "title_card" && (
              <TitleScene text={cmd.text} subtitle={cmd.subtitle} accentColor={cmd.style?.accentColor} />
            )}
            {cmd.type === "principle_card" && (
              <PrincipleScene
                title={cmd.title}
                description={cmd.description}
                principleNumber={index}
                totalPrinciples={directorCommands.filter(c => c.type === "principle_card").length}
                accentColor={cmd.style?.titleColor}
              />
            )}
            {cmd.type === "agent_card" && (
              <AgentScene
                agentName={cmd.agentName}
                role={cmd.role}
                allowedActions={cmd.allowedActions}
                tools={cmd.tools}
                proofCount={cmd.proofCount}
                accentColor={cmd.style?.accentBorder}
              />
            )}
            {cmd.type === "step_card" && (
              <WorkflowScene
                workflowName="Workflow"
                stepNumber={cmd.stepNumber}
                totalSteps={cmd.totalSteps}
                stepName={cmd.stepName}
                stepDescription={cmd.description}
                accentColor={cmd.style?.progressColor}
              />
            )}
            {cmd.type === "cta_card" && (
              <CTAScene title={cmd.title} subtitle={cmd.subtitle} accentColor={cmd.style?.buttonColor} />
            )}
          </Sequence>
        );
      })}
    </>
  );
};
