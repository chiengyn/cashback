import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Tiền lưu bằng số nguyên VND. */
const vnd = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** null với tài khoản đăng nhập bằng Apple chưa thêm số điện thoại (phải thêm trước khi rút tiền). */
  phone: text('phone').unique(),
  /** `sub` trong identity token của Sign in with Apple. */
  appleSub: text('apple_sub').unique(),
  /** Refresh token Apple, dùng để thu hồi quyền khi người dùng xoá tài khoản (Apple yêu cầu). */
  appleRefreshToken: text('apple_refresh_token'),
  /** Phần hoa hồng chia cho người dùng, tính theo phần vạn: 7000 = 70%. */
  shareBps: integer('share_bps').notNull().default(7000),
  status: text('status', { enum: ['active', 'blocked', 'deleted'] }).notNull().default('active'),
  createdAt: createdAt(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    ipHash: text('ip_hash'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('otp_phone_created_idx').on(t.phone, t.createdAt),
    index('otp_ip_created_idx').on(t.ipHash, t.createdAt),
  ],
);

/** Cache thông tin sản phẩm từ API sàn (thay cho Redis): đọc lại nếu fetched_at < 6 giờ. */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: text('platform', { enum: ['shopee', 'lazada', 'tiktok'] }).notNull(),
    shopId: text('shop_id').notNull().default(''),
    itemId: text('item_id').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title'),
    imageUrl: text('image_url'),
    price: vnd('price'),
    /** Tỉ lệ hoa hồng theo phần vạn; null khi sàn không trả. */
    commissionBps: integer('commission_bps'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('products_platform_item_uq').on(t.platform, t.shopId, t.itemId)],
);

export const clicks = pgTable(
  'clicks',
  {
    /** 10 ký tự base62, gửi sang sàn làm sub_id. */
    id: text('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    productId: uuid('product_id').notNull().references(() => products.id),
    platform: text('platform', { enum: ['shopee', 'lazada', 'tiktok'] }).notNull(),
    originalUrl: text('original_url').notNull(),
    affiliateUrl: text('affiliate_url').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    redirectedAt: timestamp('redirected_at', { withTimezone: true }),
  },
  (t) => [
    // Dùng lại click khi cùng user dán cùng sản phẩm trong 24 giờ.
    index('clicks_user_product_created_idx').on(t.userId, t.productId, t.createdAt),
    // Rate limit theo user / IP và danh sách link gần đây.
    index('clicks_user_created_idx').on(t.userId, t.createdAt),
    index('clicks_ip_created_idx').on(t.ipHash, t.createdAt),
    index('clicks_redirected_idx').on(t.redirectedAt),
  ],
);

export const conversions = pgTable(
  'conversions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: text('platform', { enum: ['shopee', 'lazada', 'tiktok'] }).notNull(),
    orderId: text('order_id').notNull(),
    itemId: text('item_id').notNull(),
    clickId: text('click_id').references(() => clicks.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    itemName: text('item_name'),
    imageUrl: text('image_url'),
    orderAmount: vnd('order_amount').notNull().default(0),
    commission: vnd('commission').notNull().default(0),
    /** Phần hoàn cho người dùng theo share_bps của họ. */
    cashback: vnd('cashback').notNull().default(0),
    /** Trạng thái theo sàn, đã chuẩn hoá. */
    platformStatus: text('platform_status', { enum: ['pending', 'completed', 'cancelled'] }).notNull(),
    /** Trạng thái hoàn tiền của app. */
    status: text('status', { enum: ['pending', 'approved', 'cancelled'] }).notNull(),
    /** Số tiền đang nằm ở ngăn "chờ duyệt" / "khả dụng" của ví do đơn này. */
    creditedPending: vnd('credited_pending').notNull().default(0),
    creditedAvailable: vnd('credited_available').notNull().default(0),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('conversions_platform_order_item_uq').on(t.platform, t.orderId, t.itemId),
    index('conversions_click_idx').on(t.clickId),
    index('conversions_user_purchased_idx').on(t.userId, t.purchasedAt),
    index('conversions_promote_idx').on(t.status, t.platformStatus, t.completedAt),
  ],
);

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    amount: vnd('amount').notNull(),
    bankName: text('bank_name').notNull(),
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name').notNull(),
    status: text('status', { enum: ['requested', 'paid', 'rejected'] }).notNull().default('requested'),
    adminNote: text('admin_note'),
    createdAt: createdAt(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [index('withdrawals_status_created_idx').on(t.status, t.createdAt)],
);

/**
 * Sổ cái chỉ thêm dòng. Số dư = SUM(pending_delta), SUM(available_delta) theo user.
 * UNIQUE (conversion_id, type) và (withdrawal_id, type) chặn ghi trùng một sự kiện.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    type: text('type', {
      enum: ['order_pending', 'order_approved', 'order_cancelled', 'order_clawback', 'withdrawal', 'withdrawal_refund'],
    }).notNull(),
    pendingDelta: vnd('pending_delta').notNull().default(0),
    availableDelta: vnd('available_delta').notNull().default(0),
    conversionId: uuid('conversion_id').references(() => conversions.id),
    withdrawalId: uuid('withdrawal_id').references(() => withdrawals.id),
    label: text('label').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_user_created_idx').on(t.userId, t.createdAt),
    uniqueIndex('ledger_conversion_type_uq').on(t.conversionId, t.type).where(sql`${t.conversionId} is not null`),
    uniqueIndex('ledger_withdrawal_type_uq').on(t.withdrawalId, t.type).where(sql`${t.withdrawalId} is not null`),
  ],
);

/** Khoá cron và mốc đồng bộ. Mỗi dòng là một job, ví dụ 'shopee:purchase'. */
export const cronJobs = pgTable('cron_jobs', {
  name: text('name').primaryKey(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }).notNull().default(sql`'epoch'`),
  lockedBy: text('locked_by'),
  syncCursor: timestamp('sync_cursor', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
});

export type Platform = (typeof products.$inferSelect)['platform'];
export type ConversionStatus = (typeof conversions.$inferSelect)['status'];
export type PlatformStatus = (typeof conversions.$inferSelect)['platformStatus'];
export type LedgerType = (typeof ledgerEntries.$inferSelect)['type'];
