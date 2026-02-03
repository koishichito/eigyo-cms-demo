import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '../components/Card'
import { Button } from '../components/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardHeader title="ページが見つかりません" subtitle="URLをご確認ください（デモ）" />
        <CardBody className="space-y-4">
          <div className="text-sm text-slate-700">
            指定されたページは存在しないか、移動された可能性があります。
          </div>
          <Link to="/dashboard">
            <Button>ホームへ戻る</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}
