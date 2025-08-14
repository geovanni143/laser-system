export default function ScoreDisplay({ hits, misses }) {
  return (
    <div className="score">
      <div className="badge success">✅ Aciertos: {hits}</div>
      <div className="badge danger">❌ Fallos: {misses}</div>
    </div>
  );
}
