"use client"

export function SetupErrorMessage({
  aiSetupError,
  collabSetupError,
}: {
  aiSetupError?: boolean
  collabSetupError?: boolean
}) {
  return (
    <div
      style={{
        margin: "40px auto",
        maxWidth: "680px",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        background: "rgba(10, 14, 25, 0.6)",
        color: "#E8EBF0",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
        Editor setup issue
      </h2>
      <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>
        Required editor services are not available right now.
      </p>
      <ul style={{ margin: "12px 0 0", paddingLeft: "20px", fontSize: "14px" }}>
        {collabSetupError && <li>Collaboration service is not configured.</li>}
        {aiSetupError && <li>AI service is not configured.</li>}
        {!collabSetupError && !aiSetupError && (
          <li>Check editor service environment settings.</li>
        )}
      </ul>
    </div>
  )
}
