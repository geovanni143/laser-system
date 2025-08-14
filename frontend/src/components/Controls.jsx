import { api } from "../lib/api";

export default function Controls({ config, onConfigChange, onReset }) {
  const setDiff = async (difficulty) => {
    const { data } = await api.put("/config", { difficulty });
    onConfigChange(data);
  };

  return (
    <div className="controls">
      <p><b>Dificultad actual:</b> {config.difficulty?.[0]?.toUpperCase() + config.difficulty?.slice(1)}</p>
      <p>🕒 Tiempo LED azul: <b>{(config.window_ms / 1000).toFixed(0)}s</b></p>
      <div className="buttons">
        <button onClick={() => setDiff("facil")}>Fácil</button>
        <button onClick={() => setDiff("medio")}>Medio</button>
        <button onClick={() => setDiff("dificil")}>Difícil</button>
      </div>
      <button className="reset" onClick={onReset}>🔁 Reiniciar sistema</button>
    </div>
  );
}
