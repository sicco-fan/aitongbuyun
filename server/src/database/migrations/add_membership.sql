-- 会员系统数据库迁移脚本
-- 执行方式：在 Supabase SQL Editor 中运行此脚本

-- 1. 为 users 表添加会员相关字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS member_type VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_early_adopter BOOLEAN DEFAULT FALSE;

-- member_type 说明：
-- 'free' - 免费用户
-- 'monthly' - 月度会员
-- 'yearly' - 年度会员  
-- 'lifetime' - 终身会员

-- 2. 为已有用户设置早期用户标记（在收费日期前注册的用户）
-- 2026年4月15日前注册的用户自动获得永久免费会员
UPDATE users 
SET is_early_adopter = TRUE 
WHERE created_at < '2026-04-15 00:00:00'::timestamptz;

-- 3. 创建会员记录表（可选，用于记录会员购买历史）
CREATE TABLE IF NOT EXISTS membership_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  order_type VARCHAR(20) NOT NULL, -- 'monthly' | 'yearly' | 'lifetime'
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method VARCHAR(50), -- 'alipay' | 'wechat' | 'apple_iap' | 'coze'
  payment_id VARCHAR(255), -- 第三方支付单号
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  extra JSONB
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_users_member_type ON users(member_type);
CREATE INDEX IF NOT EXISTS idx_users_member_expire ON users(member_expire_at);
CREATE INDEX IF NOT EXISTS idx_users_early_adopter ON users(is_early_adopter);
CREATE INDEX IF NOT EXISTS idx_membership_orders_user ON membership_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_orders_status ON membership_orders(status);
