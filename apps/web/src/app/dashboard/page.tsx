"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:8787/api/v1/runs")
      .then(r => r.json())
      .then(setRuns);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Eval Runs</h1>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Strategy</th>
            <th className="border p-2">Model</th>
            <th className="border p-2">Overall F1</th>
            <th className="border p-2">Cost</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.id} className="hover:bg-gray-50">
              <td className="border p-2 font-mono">{run.strategy}</td>
              <td className="border p-2 text-center text-sm">{run.model}</td>
              <td className="border p-2 text-center">
                {run.aggregate_scores?.overall?.toFixed(3) ?? "—"}
              </td>
              <td className="border p-2 text-center">
                ${run.total_cost_usd?.toFixed(4) ?? "—"}
              </td>
              <td className="border p-2 text-center">
                <span className={`px-2 py-1 rounded text-xs ${
                  run.status === "done" ? "bg-green-100 text-green-800" :
                  run.status === "running" ? "bg-blue-100 text-blue-800" :
                  "bg-red-100 text-red-800"
                }`}>{run.status}</span>
              </td>
              <td className="border p-2 text-center">
                <a href={`/dashboard/${run.id}`}
                   className="text-blue-600 underline text-sm mr-2">
                  Detail
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-2">Compare Two Runs</h2>
        <CompareSelector runs={runs} />
      </div>
    </div>
  );
}

function CompareSelector({ runs }: { runs: any[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<any>(null);

  async function compare() {
    const r = await fetch(
      `http://localhost:8787/api/v1/compare?runA=${a}&runB=${b}`
    );
    setResult(await r.json());
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <select value={a} onChange={e => setA(e.target.value)}
          className="border p-2 rounded">
          <option value="">Select Run A</option>
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.strategy} — {r.id.slice(0,8)}</option>
          ))}
        </select>
        <select value={b} onChange={e => setB(e.target.value)}
          className="border p-2 rounded">
          <option value="">Select Run B</option>
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.strategy} — {r.id.slice(0,8)}</option>
          ))}
        </select>
        <button onClick={compare}
          className="bg-blue-600 text-white px-4 py-2 rounded">
          Compare
        </button>
      </div>

      {result && (
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Field</th>
              <th className="border p-2">Run A ({result.runA?.strategy})</th>
              <th className="border p-2">Run B ({result.runB?.strategy})</th>
              <th className="border p-2">Delta</th>
              <th className="border p-2">Winner</th>
            </tr>
          </thead>
          <tbody>
            {result.deltas?.map((d: any) => (
              <tr key={d.field}>
                <td className="border p-2 font-mono">{d.field}</td>
                <td className="border p-2 text-center">{d.runA.toFixed(3)}</td>
                <td className="border p-2 text-center">{d.runB.toFixed(3)}</td>
                <td className={`border p-2 text-center font-bold ${
                  d.delta > 0.01 ? "text-green-600" :
                  d.delta < -0.01 ? "text-red-600" : "text-gray-500"
                }`}>
                  {d.delta > 0 ? "+" : ""}{d.delta.toFixed(3)}
                </td>
                <td className="border p-2 text-center">
                  {d.winner === "tie" ? "—" :
                   d.winner === "B" ? "🏆 B" : "🏆 A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}