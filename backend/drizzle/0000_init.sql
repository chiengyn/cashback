CREATE TABLE "clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"product_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"original_url" text NOT NULL,
	"affiliate_url" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redirected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"order_id" text NOT NULL,
	"item_id" text NOT NULL,
	"click_id" text,
	"user_id" uuid,
	"item_name" text,
	"image_url" text,
	"order_amount" bigint DEFAULT 0 NOT NULL,
	"commission" bigint DEFAULT 0 NOT NULL,
	"cashback" bigint DEFAULT 0 NOT NULL,
	"platform_status" text NOT NULL,
	"status" text NOT NULL,
	"credited_pending" bigint DEFAULT 0 NOT NULL,
	"credited_available" bigint DEFAULT 0 NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_jobs" (
	"name" text PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone DEFAULT 'epoch' NOT NULL,
	"locked_by" text,
	"sync_cursor" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"pending_delta" bigint DEFAULT 0 NOT NULL,
	"available_delta" bigint DEFAULT 0 NOT NULL,
	"conversion_id" uuid,
	"withdrawal_id" uuid,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"ip_hash" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"shop_id" text DEFAULT '' NOT NULL,
	"item_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text,
	"image_url" text,
	"price" bigint,
	"commission_bps" integer,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"share_bps" integer DEFAULT 7000 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_click_id_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."clicks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_conversion_id_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."conversions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_user_product_created_idx" ON "clicks" USING btree ("user_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_user_created_idx" ON "clicks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_ip_created_idx" ON "clicks" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "clicks_redirected_idx" ON "clicks" USING btree ("redirected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_platform_order_item_uq" ON "conversions" USING btree ("platform","order_id","item_id");--> statement-breakpoint
CREATE INDEX "conversions_click_idx" ON "conversions" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "conversions_user_purchased_idx" ON "conversions" USING btree ("user_id","purchased_at");--> statement-breakpoint
CREATE INDEX "conversions_promote_idx" ON "conversions" USING btree ("status","platform_status","completed_at");--> statement-breakpoint
CREATE INDEX "ledger_user_created_idx" ON "ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_conversion_type_uq" ON "ledger_entries" USING btree ("conversion_id","type") WHERE "ledger_entries"."conversion_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_withdrawal_type_uq" ON "ledger_entries" USING btree ("withdrawal_id","type") WHERE "ledger_entries"."withdrawal_id" is not null;--> statement-breakpoint
CREATE INDEX "otp_phone_created_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "otp_ip_created_idx" ON "otp_codes" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_platform_item_uq" ON "products" USING btree ("platform","shop_id","item_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawals_status_created_idx" ON "withdrawals" USING btree ("status","created_at");