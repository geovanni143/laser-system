export default function Logs({ events }) {
  return (
    <div>
      <h4>📜 Historial de eventos:</h4>
      <ul className="logs">
        {events.length === 0 && <li>Sin eventos aún.</li>}
        {events.map((e, i) => (
          <li key={i}>
            <b>{e.type === "hit" ? "ACIERT0" : "FALLO"}</b> · ventana: {e.window_ms}ms · {new Date(e.ts).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
