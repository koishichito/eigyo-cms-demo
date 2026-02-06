-- ============================================================
-- J-Navi 営業マッチングプラットフォーム
-- Supabase 本番スキーマ
-- ============================================================

-- -------------------------
-- 1. テーブル定義
-- -------------------------

-- プロフィール (auth.users 拡張)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('J-Navi管理者', '代理店', 'コネクター')),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  bank_account JSONB,          -- { bankName, branchName, accountType, accountNumber, accountHolder }
  invite_code  TEXT UNIQUE,    -- 代理店のみ
  agency_id    UUID REFERENCES profiles(id),           -- コネクターのみ
  introduced_by_id UUID REFERENCES profiles(id)        -- コネクターのみ（参考）
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_agency_id ON profiles(agency_id);
CREATE INDEX idx_profiles_invite_code ON profiles(invite_code);

-- サプライヤー
CREATE TABLE suppliers (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  note  TEXT
);

-- 商品
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('サイネージ', 'ホテル', '広告枠')),
  type            TEXT NOT NULL CHECK (type IN ('signage', 'hotel_membership', 'ad_slot')),
  list_price_jpy  INTEGER NOT NULL DEFAULT 0,
  image_url       TEXT,
  description     TEXT NOT NULL DEFAULT '',
  materials       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  ad_spec         JSONB,        -- { address, mapUrl, size, playbackFrequency }
  vacancy_status  TEXT CHECK (vacancy_status IS NULL OR vacancy_status IN ('募集中', '売切'))
);

CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_is_public ON products(is_public);

-- 商談
CREATE TABLE deals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked                 BOOLEAN NOT NULL DEFAULT false,
  status                 TEXT NOT NULL,
  connector_id           UUID NOT NULL REFERENCES profiles(id),
  product_id             UUID NOT NULL REFERENCES products(id),
  customer_company_name  TEXT NOT NULL,
  customer_name          TEXT NOT NULL,
  customer_email         TEXT NOT NULL,
  customer_phone         TEXT,
  memo                   TEXT,
  source                 TEXT NOT NULL CHECK (source IN ('紹介LP', '手動')),
  final_sale_amount_jpy  INTEGER,
  closing_date           DATE
);

CREATE INDEX idx_deals_connector_id ON deals(connector_id);
CREATE INDEX idx_deals_status ON deals(status);

-- 取引（売上確定）
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deal_id             UUID NOT NULL REFERENCES deals(id),
  closing_date        DATE NOT NULL,
  product_snapshot    JSONB NOT NULL,
  connector_id        UUID NOT NULL REFERENCES profiles(id),
  agency_id           UUID NOT NULL REFERENCES profiles(id),
  sale_amount_jpy     INTEGER NOT NULL,
  base_amount_jpy     INTEGER NOT NULL,
  rates_used          JSONB NOT NULL,   -- { agencyRate, connectorRate }
  agency_reward_jpy   INTEGER NOT NULL,
  connector_reward_jpy INTEGER NOT NULL,
  jnavi_share_jpy     INTEGER NOT NULL
);

CREATE INDEX idx_transactions_connector_id ON transactions(connector_id);
CREATE INDEX idx_transactions_agency_id ON transactions(agency_id);
CREATE INDEX idx_transactions_deal_id ON transactions(deal_id);

-- 報酬配分
CREATE TABLE allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  recipient_type    TEXT NOT NULL CHECK (recipient_type IN ('ユーザー報酬', 'Jnavi取り分')),
  user_id           UUID REFERENCES profiles(id),
  user_role         TEXT CHECK (user_role IS NULL OR user_role IN ('代理店', 'コネクター')),
  label             TEXT NOT NULL,
  rate              NUMERIC,
  base_amount_jpy   INTEGER,
  amount_jpy        INTEGER NOT NULL,
  status            TEXT CHECK (status IS NULL OR status IN ('未確定', '確定', '支払済み')),
  payout_request_id UUID
);

CREATE INDEX idx_allocations_transaction_id ON allocations(transaction_id);
CREATE INDEX idx_allocations_user_id ON allocations(user_id);
CREATE INDEX idx_allocations_status ON allocations(status);

-- 出金申請
CREATE TABLE payout_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_jpy    INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('申請中', '支払済み')) DEFAULT '申請中',
  processed_at  TIMESTAMPTZ
);

ALTER TABLE allocations
  ADD CONSTRAINT fk_allocations_payout_request
  FOREIGN KEY (payout_request_id) REFERENCES payout_requests(id);

CREATE INDEX idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);

-- システム設定（シングルトン）
CREATE TABLE system_settings (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_payout_jpy  INTEGER NOT NULL DEFAULT 5000,
  agency_rate     NUMERIC NOT NULL DEFAULT 0.15,
  connector_rate  NUMERIC NOT NULL DEFAULT 0.05
);

INSERT INTO system_settings (id, min_payout_jpy, agency_rate, connector_rate)
VALUES (1, 5000, 0.15, 0.05);

-- 操作ログ
CREATE TABLE operation_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id  TEXT NOT NULL,  -- UUID or 'SYSTEM'
  action         TEXT NOT NULL,
  detail         TEXT NOT NULL DEFAULT '',
  related_id     TEXT
);

CREATE INDEX idx_operation_logs_at ON operation_logs(at DESC);

-- デモ用メール送信箱
CREATE TABLE outbox (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------
-- 2. Auth トリガー: ユーザー作成時にプロフィール自動作成
-- -------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, email, invite_code, agency_id, introduced_by_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'コネクター'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'invite_code',
    NULLIF(NEW.raw_user_meta_data->>'agency_id', '')::UUID,
    NULLIF(NEW.raw_user_meta_data->>'introduced_by_id', '')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------------------------
-- 3. RLS 有効化
-- -------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- 4. RLS ポリシー
-- -------------------------

-- Helper: 現在ユーザーのロール取得
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: 現在ユーザーの代理店ID取得（コネクターの場合）
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$;

-- == profiles ==
-- 認証ユーザーは全プロフィール参照可（組織図表示に必要）
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- anon は公開情報のみ（invite_code検索、コネクター情報表示に必要）
CREATE POLICY profiles_select_anon ON profiles
  FOR SELECT TO anon
  USING (true);

-- 自分のプロフィールのみ更新可
CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- == suppliers ==
CREATE POLICY suppliers_select ON suppliers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY suppliers_insert ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'J-Navi管理者');

-- == products ==
-- 認証ユーザーは全商品参照
CREATE POLICY products_select ON products
  FOR SELECT TO authenticated
  USING (true);

-- anon は公開商品のみ（LP用）
CREATE POLICY products_select_anon ON products
  FOR SELECT TO anon
  USING (is_public = true);

-- 管理者のみ商品作成・更新
CREATE POLICY products_insert ON products
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'J-Navi管理者');

CREATE POLICY products_update ON products
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'J-Navi管理者')
  WITH CHECK (get_my_role() = 'J-Navi管理者');

-- == deals ==
-- 管理者: 全件, 代理店: 配下コネクターの商談, コネクター: 自分の商談
CREATE POLICY deals_select ON deals
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR connector_id = auth.uid()
    OR connector_id IN (
      SELECT id FROM public.profiles WHERE agency_id = auth.uid()
    )
  );

-- コネクター・管理者が商談作成
CREATE POLICY deals_insert ON deals
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('J-Navi管理者', 'コネクター')
  );

-- 商談更新: 管理者、または関係するコネクター/代理店
CREATE POLICY deals_update ON deals
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR connector_id = auth.uid()
    OR connector_id IN (
      SELECT id FROM public.profiles WHERE agency_id = auth.uid()
    )
  );

-- == transactions ==
CREATE POLICY transactions_select ON transactions
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR connector_id = auth.uid()
    OR agency_id = auth.uid()
  );

-- INSERT は RPC 関数経由（SECURITY DEFINER）
CREATE POLICY transactions_insert ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('J-Navi管理者', 'コネクター', '代理店')
  );

-- == allocations ==
CREATE POLICY allocations_select ON allocations
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR user_id = auth.uid()
    OR transaction_id IN (
      SELECT id FROM public.transactions WHERE agency_id = auth.uid()
    )
  );

CREATE POLICY allocations_insert ON allocations
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- RPC関数経由のみ

CREATE POLICY allocations_update ON allocations
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR user_id = auth.uid()
  );

-- == payout_requests ==
CREATE POLICY payout_requests_select ON payout_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'J-Navi管理者'
    OR user_id = auth.uid()
  );

CREATE POLICY payout_requests_insert ON payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payout_requests_update ON payout_requests
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'J-Navi管理者');

-- == system_settings ==
CREATE POLICY settings_select ON system_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY settings_select_anon ON system_settings
  FOR SELECT TO anon
  USING (true);

CREATE POLICY settings_update ON system_settings
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'J-Navi管理者');

-- == operation_logs ==
CREATE POLICY logs_select ON operation_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'J-Navi管理者');

CREATE POLICY logs_insert ON operation_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- == outbox ==
CREATE POLICY outbox_select ON outbox
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY outbox_insert ON outbox
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------
-- 5. RPC 関数 (複合操作)
-- -------------------------

-- 紹介LP からの商談作成（anon アクセス可能）
CREATE OR REPLACE FUNCTION create_referral_deal(
  p_connector_id UUID,
  p_product_id UUID,
  p_customer_company_name TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_memo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_product RECORD;
  v_connector RECORD;
  v_deal_id UUID;
  v_initial_status TEXT;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND is_public = true;
  IF NOT FOUND THEN RAISE EXCEPTION '商品が見つかりません';
  END IF;

  SELECT * INTO v_connector FROM public.profiles WHERE id = p_connector_id AND role = 'コネクター';
  IF NOT FOUND THEN RAISE EXCEPTION 'コネクターが見つかりません';
  END IF;

  -- 商品タイプに応じた初期ステータス
  IF v_product.type = 'signage' THEN v_initial_status := 'リード発生';
  ELSE v_initial_status := '申し込み';
  END IF;

  INSERT INTO public.deals (connector_id, product_id, status, customer_company_name, customer_name, customer_email, customer_phone, memo, source)
  VALUES (p_connector_id, p_product_id, v_initial_status, p_customer_company_name, p_customer_name, p_customer_email, p_customer_phone, p_memo, '紹介LP')
  RETURNING id INTO v_deal_id;

  INSERT INTO public.operation_logs (actor_user_id, action, detail, related_id)
  VALUES ('SYSTEM', 'リード登録', v_product.name || ' / connector=' || v_connector.name, v_deal_id::TEXT);

  RETURN v_deal_id;
END;
$$;

-- anon からも呼べるように GRANT
GRANT EXECUTE ON FUNCTION create_referral_deal TO anon;
GRANT EXECUTE ON FUNCTION create_referral_deal TO authenticated;

-- 売上確定
CREATE OR REPLACE FUNCTION finalize_deal(
  p_deal_id UUID,
  p_final_sale_amount_jpy INTEGER,
  p_closing_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_deal RECORD;
  v_product RECORD;
  v_connector RECORD;
  v_agency RECORD;
  v_settings RECORD;
  v_tx_id UUID;
  v_base INTEGER;
  v_agency_reward INTEGER;
  v_connector_reward INTEGER;
  v_jnavi_share INTEGER;
  v_init_status TEXT;
  v_next_status TEXT;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION '商談が見つかりません';
  END IF;
  IF v_deal.locked THEN RAISE EXCEPTION '既に売上確定済みです';
  END IF;
  IF p_final_sale_amount_jpy <= 0 THEN RAISE EXCEPTION '金額が不正です';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_deal.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION '商品が見つかりません';
  END IF;

  SELECT * INTO v_connector FROM public.profiles WHERE id = v_deal.connector_id AND role = 'コネクター';
  IF NOT FOUND THEN RAISE EXCEPTION 'コネクター情報が不正です';
  END IF;

  SELECT * INTO v_agency FROM public.profiles WHERE id = v_connector.agency_id AND role = '代理店';
  IF NOT FOUND THEN RAISE EXCEPTION '所属代理店が見つかりません';
  END IF;

  SELECT * INTO v_settings FROM public.system_settings WHERE id = 1;

  -- 報酬計算
  v_base := p_final_sale_amount_jpy;
  v_agency_reward := FLOOR(v_base * v_settings.agency_rate);
  v_connector_reward := FLOOR(v_base * v_settings.connector_rate);
  v_jnavi_share := GREATEST(0, v_base - v_agency_reward - v_connector_reward);

  -- 初期報酬ステータス
  IF v_product.type = 'hotel_membership' THEN v_init_status := '確定';
  ELSE v_init_status := '未確定';
  END IF;

  -- 売上確定後のステータス
  IF v_product.type = 'hotel_membership' THEN v_next_status := '決済完了';
  ELSIF v_product.type = 'ad_slot' THEN v_next_status := '掲載開始';
  ELSE v_next_status := '施工完了';
  END IF;

  -- Transaction 作成
  INSERT INTO public.transactions (
    deal_id, closing_date, product_snapshot,
    connector_id, agency_id,
    sale_amount_jpy, base_amount_jpy, rates_used,
    agency_reward_jpy, connector_reward_jpy, jnavi_share_jpy
  ) VALUES (
    v_deal.id, p_closing_date,
    jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'category', v_product.category,
      'type', v_product.type,
      'supplierId', v_product.supplier_id,
      'listPriceJPY', v_product.list_price_jpy
    ),
    v_connector.id, v_agency.id,
    p_final_sale_amount_jpy, v_base,
    jsonb_build_object('agencyRate', v_settings.agency_rate, 'connectorRate', v_settings.connector_rate),
    v_agency_reward, v_connector_reward, v_jnavi_share
  ) RETURNING id INTO v_tx_id;

  -- Allocations
  INSERT INTO public.allocations (transaction_id, recipient_type, user_id, user_role, label, rate, base_amount_jpy, amount_jpy, status)
  VALUES
    (v_tx_id, 'ユーザー報酬', v_agency.id, '代理店',
     '代理店報酬（' || ROUND(v_settings.agency_rate * 100) || '%）',
     v_settings.agency_rate, v_base, v_agency_reward, v_init_status),
    (v_tx_id, 'ユーザー報酬', v_connector.id, 'コネクター',
     'コネクター報酬（' || ROUND(v_settings.connector_rate * 100) || '%）',
     v_settings.connector_rate, v_base, v_connector_reward, v_init_status),
    (v_tx_id, 'Jnavi取り分', NULL, NULL,
     'Jnavi取り分（残余）',
     NULL, NULL, v_jnavi_share, NULL);

  -- Deal 更新
  UPDATE public.deals
  SET locked = true,
      status = v_next_status,
      final_sale_amount_jpy = p_final_sale_amount_jpy,
      closing_date = p_closing_date
  WHERE id = p_deal_id;

  -- ログ
  INSERT INTO public.operation_logs (actor_user_id, action, detail, related_id)
  VALUES (
    COALESCE(v_actor_id::TEXT, 'SYSTEM'),
    '売上確定',
    v_deal.id::TEXT || ' / ' || v_product.name || ' / ' || v_agency.name || 'に' || ROUND(v_settings.agency_rate * 100) || '%、' || v_connector.name || 'に' || ROUND(v_settings.connector_rate * 100) || '%',
    v_deal.id::TEXT
  );

  RETURN v_tx_id;
END;
$$;

-- 報酬確定（管理者）
CREATE OR REPLACE FUNCTION admin_confirm_rewards(p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  -- 管理者チェック
  IF (SELECT role FROM public.profiles WHERE id = v_actor_id) != 'J-Navi管理者' THEN
    RAISE EXCEPTION '権限がありません';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_transaction_id) THEN
    RAISE EXCEPTION '取引が見つかりません';
  END IF;

  UPDATE public.allocations
  SET status = '確定'
  WHERE transaction_id = p_transaction_id
    AND recipient_type = 'ユーザー報酬'
    AND status = '未確定';

  INSERT INTO public.operation_logs (actor_user_id, action, detail, related_id)
  VALUES (v_actor_id::TEXT, '報酬確定', 'transaction=' || p_transaction_id::TEXT, p_transaction_id::TEXT);
END;
$$;

-- 出金一括申請
CREATE OR REPLACE FUNCTION request_payout_all()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_available INTEGER;
  v_min_payout INTEGER;
  v_payout_id UUID;
BEGIN
  v_user_id := auth.uid();
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  IF v_role NOT IN ('代理店', 'コネクター') THEN
    RAISE EXCEPTION '権限がありません';
  END IF;

  SELECT COALESCE(SUM(amount_jpy), 0) INTO v_available
  FROM public.allocations
  WHERE recipient_type = 'ユーザー報酬'
    AND user_id = v_user_id
    AND status = '確定'
    AND payout_request_id IS NULL;

  SELECT min_payout_jpy INTO v_min_payout FROM public.system_settings WHERE id = 1;

  IF v_available < v_min_payout THEN
    RAISE EXCEPTION '出金可能額が最低金額（%円）に達していません', v_min_payout;
  END IF;

  INSERT INTO public.payout_requests (user_id, amount_jpy, status)
  VALUES (v_user_id, v_available, '申請中')
  RETURNING id INTO v_payout_id;

  UPDATE public.allocations
  SET payout_request_id = v_payout_id
  WHERE recipient_type = 'ユーザー報酬'
    AND user_id = v_user_id
    AND status = '確定'
    AND payout_request_id IS NULL;

  INSERT INTO public.operation_logs (actor_user_id, action, detail, related_id)
  VALUES (v_user_id::TEXT, '出金申請', v_payout_id::TEXT || ' / ' || v_available || '円', v_payout_id::TEXT);

  RETURN v_payout_id;
END;
$$;

-- 出金支払処理（管理者）
CREATE OR REPLACE FUNCTION admin_mark_payout_paid(p_payout_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_pr RECORD;
BEGIN
  v_actor_id := auth.uid();

  IF (SELECT role FROM public.profiles WHERE id = v_actor_id) != 'J-Navi管理者' THEN
    RAISE EXCEPTION '権限がありません';
  END IF;

  SELECT * INTO v_pr FROM public.payout_requests WHERE id = p_payout_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION '出金申請が見つかりません';
  END IF;
  IF v_pr.status = '支払済み' THEN RAISE EXCEPTION '既に支払済みです';
  END IF;

  UPDATE public.payout_requests
  SET status = '支払済み', processed_at = now()
  WHERE id = p_payout_request_id;

  UPDATE public.allocations
  SET status = '支払済み'
  WHERE payout_request_id = p_payout_request_id;

  INSERT INTO public.operation_logs (actor_user_id, action, detail, related_id)
  VALUES (v_actor_id::TEXT, '出金支払', p_payout_request_id::TEXT || ' / user=' || v_pr.user_id::TEXT, p_payout_request_id::TEXT);
END;
$$;
