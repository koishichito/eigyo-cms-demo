import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { useDb } from '../state/DbProvider'

export default function OutboxPage() {
  const { db, actions } = useDb()

  return (
    <div className="mx-auto max-w-3xl">
      <Card
        title="デモメールボックス（Outbox）"
        subtitle="※本番ではメール送信基盤へ。デモでは localStorage に保存して表示します。"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <Link to="/login" className="text-blue-600 hover:underline">
              ログインへ戻る
            </Link>
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => actions.resetAll()}
          >
            デモデータ初期化
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {db.outbox.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              まだメールはありません。
            </div>
          ) : null}

          {db.outbox.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{m.subject}</div>
                <div className="text-xs text-slate-500">{new Date(m.sentAt).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-sm text-slate-700">To: {m.to}</div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
{m.body}
              </pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
