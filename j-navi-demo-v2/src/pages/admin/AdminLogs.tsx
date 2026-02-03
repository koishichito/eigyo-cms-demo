import { Card } from '../../components/Card'
import { useDb } from '../../state/DbProvider'
import { findUser, getCurrentUser } from '../../state/selectors'

export default function AdminLogsPage() {
  const { db } = useDb()
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="監査ログ" subtitle="このページは管理者向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  return (
    <Card title="監査ログ" subtitle="案件IDごとの配分（15%/5%）など重要操作の記録">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">日時</th>
              <th className="px-3 py-2">操作</th>
              <th className="px-3 py-2">実行者</th>
              <th className="px-3 py-2">詳細</th>
              <th className="px-3 py-2">関連ID</th>
            </tr>
          </thead>
          <tbody>
            {db.logs.map((l) => {
              const actor = findUser(db, l.actorUserId)
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-600">{new Date(l.at).toLocaleString()}</td>
                  <td className="px-3 py-2">{l.action}</td>
                  <td className="px-3 py-2 text-slate-700">{actor ? actor.name : l.actorUserId}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{l.detail}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.relatedId ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {db.logs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          ログがありません。
        </div>
      ) : null}
    </Card>
  )
}
