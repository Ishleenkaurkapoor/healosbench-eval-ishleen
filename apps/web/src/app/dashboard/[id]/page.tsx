"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RunDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    fetch(`http://localhost:8787/api/v1/runs/${id}`)
      .then(r => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">
        Run: {data.strategy} 
        <span className="text-sm font-normal ml-2 text-gray-500">
          {data.id}
        </span>
      </h1>

      {/* Aggregate scores */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {data.aggregate_scores && Object.entries(data.aggregate_scores)
          .map(([field, score]: any) => (
          <div key={field} className="border rounded p-3 text-center">
            <div className="text-xs text-gray-500">{field}</div>
            <div className="text-xl font-bold">{score.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Cases table */}
        <div className="flex-1">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1">ID</th>
                <th className="border p-1">CC</th>
                <th className="border p-1">Vitals</th>
                <th className="border p-1">Meds</th>
                <th className="border p-1">Dx</th>
                <th className="border p-1">Plan</th>
                <th className="border p-1">F1</th>
                <th className="border p-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.cases?.map((c: any) => (
                <tr key={c.id}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => setSelected(c)}>
                  <td className="border p-1 font-mono text-xs">
                    {c.transcript_id}
                  </td>
                  {["chief_complaint","vitals","medications",
                    "diagnoses","plan"].map(f => (
                    <td key={f} className="border p-1 text-center">
                      <span className={
                        (c.scores?.[f] ?? 0) >= 0.8 ? "text-green-600" :
                        (c.scores?.[f] ?? 0) >= 0.5 ? "text-amber-600" :
                        "text-red-600"
                      }>
                        {(c.scores?.[f] ?? 0).toFixed(2)}
                      </span>
                    </td>
                  ))}
                  <td className="border p-1 text-center font-bold">
                    {(c.scores?.overall ?? 0).toFixed(2)}
                  </td>
                  <td className="border p-1 text-center">
                    <span className={`text-xs px-1 rounded ${
                      c.status === "done" ? "bg-green-100" : "bg-red-100"
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Case detail panel */}
        {selected && (
          <div className="w-96 border rounded p-4 text-sm overflow-auto">
            <h3 className="font-bold mb-2">{selected.transcript_id}</h3>
            <div className="mb-3">
              <div className="font-semibold text-xs text-gray-500 mb-1">
                PREDICTED
              </div>
              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-48">
                {JSON.stringify(selected.prediction, null, 2)}
              </pre>
            </div>
            {selected.hallucinations?.length > 0 && (
              <div className="mb-3">
                <div className="font-semibold text-xs text-red-500 mb-1">
                  HALLUCINATIONS ({selected.hallucinations.length})
                </div>
                {selected.hallucinations.map((h: string) => (
                  <div key={h} className="text-red-600 text-xs">{h}</div>
                ))}
              </div>
            )}
            <div className="mb-3">
              <div className="font-semibold text-xs text-gray-500 mb-1">
                ATTEMPTS: {selected.attempts?.length ?? 0}
                {" "}| CACHE READ: {selected.tokens?.cache_read ?? 0}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}