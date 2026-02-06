-- ============================================================
-- J-Navi シードデータ
-- Supabase ローカル開発用 (supabase db reset で投入)
-- ============================================================
-- 注意: auth.users の作成は Supabase Dashboard または Admin API で行ってください。
-- ローカル開発では supabase db reset 時に以下の auth.users INSERT が使えます。

-- 固定 UUID（シードデータ用）
-- usr_admin:        11111111-1111-1111-1111-111111111111
-- usr_agency_a:     22222222-2222-2222-2222-222222222222
-- usr_agency_b:     33333333-3333-3333-3333-333333333333
-- usr_connector_a:  44444444-4444-4444-4444-444444444444
-- usr_connector_b:  55555555-5555-5555-5555-555555555555
-- usr_connector_c:  66666666-6666-6666-6666-666666666666
-- sup_001:          77777777-7777-7777-7777-777777777777

-- Auth users (ローカル開発用)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@j-navi.test', crypt('admin123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"J-Navi管理者","name":"Jnavi運営（デモ管理者）"}',
   '2026-01-01T00:00:00Z', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'agencya@j-navi.test', crypt('agency123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"代理店","name":"代理店A","invite_code":"AG-A123"}',
   '2026-01-02T00:00:00Z', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'agencyb@j-navi.test', crypt('agency123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"代理店","name":"代理店B","invite_code":"AG-B456"}',
   '2026-01-02T00:00:00Z', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'connectora@j-navi.test', crypt('connector123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"コネクター","name":"コネクターA","agency_id":"22222222-2222-2222-2222-222222222222","introduced_by_id":"22222222-2222-2222-2222-222222222222"}',
   '2026-01-03T00:00:00Z', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'connectorb@j-navi.test', crypt('connector123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"コネクター","name":"コネクターB","agency_id":"22222222-2222-2222-2222-222222222222","introduced_by_id":"44444444-4444-4444-4444-444444444444"}',
   '2026-01-04T00:00:00Z', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'connectorc@j-navi.test', crypt('connector123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"role":"コネクター","name":"コネクターC","agency_id":"33333333-3333-3333-3333-333333333333","introduced_by_id":"33333333-3333-3333-3333-333333333333"}',
   '2026-01-04T00:00:00Z', now(), '', '', '', '');

-- auth.identities (Supabase Auth が必要とする)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id, id, id, jsonb_build_object('sub', id::TEXT, 'email', email), 'email', now(), created_at, now()
FROM auth.users;

-- Profiles は handle_new_user トリガーが作成するが、bank_account 等を追加更新
UPDATE profiles SET bank_account = '{"bankName":"デモ銀行","branchName":"本店","accountType":"普通","accountNumber":"1234567","accountHolder":"コネクターA"}'::jsonb
WHERE id = '44444444-4444-4444-4444-444444444444';

-- サプライヤー
INSERT INTO suppliers (id, name, note) VALUES
  ('77777777-7777-7777-7777-777777777777', 'デモメーカー（サプライヤー）', '顧客→メーカー入金 / メーカー→Jnaviへ手数料支払い（デモ）');

-- 商品
INSERT INTO products (id, supplier_id, name, category, type, list_price_jpy, description, materials, is_public, ad_spec, vacancy_status) VALUES
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777',
   '窓ガラスサイネージ', 'サイネージ', 'signage', 1000000,
   '店舗やオフィスの窓面をサイネージ化する高単価商材。リード→商談→契約→施工完了で売上確定。',
   '[{"label":"提案資料（PDF）","href":"https://example.com/demo_signage.pdf"}]'::jsonb,
   true, NULL, NULL),

  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777',
   'JNホテル会員権', 'ホテル', 'hotel_membership', 300000,
   '物販的・即決型の会員権。申し込み→決済完了で売上確定（デモでは即時確定）。',
   '[{"label":"会員権パンフ（PDF）","href":"https://example.com/demo_hotel.pdf"}]'::jsonb,
   true, NULL, NULL),

  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777',
   '広告枠', '広告枠', 'ad_slot', 100000,
   'ストック型・継続型の広告枠（月額）。申し込み→審査→掲載開始で売上確定（デモは初月分のみ）。',
   '[{"label":"媒体資料（PDF）","href":"https://example.com/demo_ad.pdf"}]'::jsonb,
   true,
   '{"address":"東京都渋谷区（デモ）","mapUrl":"https://maps.google.com","size":"H2000×W3000","playbackFrequency":"10秒×6枠/時"}'::jsonb,
   '募集中');
