import React from "react";

function MapPreview({ data }) {
  return (
    <div>
      <em>Map preview for this point goes here.</em>
      <pre style={{ background: "#f8f9fa", padding: 8 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default MapPreview;