import { pgTable, serial, timestamp, varchar, text, integer, index, foreignKey, boolean, doublePrecision, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ========== 用户系统 ==========

// 用户表
export const users = pgTable("users", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	phone: varchar("phone", { length: 20 }),
	nickname: varchar("nickname", { length: 100 }),
	deviceId: varchar("device_id", { length: 100 }),
	role: varchar("role", { length: 20 }).default('user'), // admin / user
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("users_phone_idx").on(table.phone),
	index("users_device_id_idx").on(table.deviceId),
	index("users_role_idx").on(table.role),
]);

// 验证码表
export const verificationCodes = pgTable("verification_codes", {
	id: serial().primaryKey().notNull(),
	phone: varchar("phone", { length: 20 }).notNull(),
	code: varchar("code", { length: 6 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	used: boolean("used").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("verification_codes_phone_idx").on(table.phone),
	index("verification_codes_expires_at_idx").on(table.expiresAt),
]);

// ========== 学习统计系统 ==========

// 学习记录表 - 记录每次学习详情
export const learningStats = pgTable("learning_stats", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	sentenceFileId: integer("sentence_file_id").notNull(),
	sentenceItemId: integer("sentence_item_id").notNull(),
	wordsCorrect: integer("words_correct").default(0),
	wordsTotal: integer("words_total").default(0),
	score: doublePrecision("score").default(0),
	durationSeconds: integer("duration_seconds").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("learning_stats_user_id_idx").on(table.userId),
	index("learning_stats_sentence_file_id_idx").on(table.sentenceFileId),
	index("learning_stats_created_at_idx").on(table.createdAt),
]);

// 每日统计表
export const dailyStats = pgTable("daily_stats", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
	totalScore: doublePrecision("total_score").default(0),
	totalDuration: integer("total_duration").default(0), // 秒
	sentencesCompleted: integer("sentences_completed").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("daily_stats_user_id_idx").on(table.userId),
	index("daily_stats_date_idx").on(table.date),
	unique("daily_stats_user_date_key").on(table.userId, table.date),
]);

// 句库学习汇总表
export const fileLearningSummary = pgTable("file_learning_summary", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	sentenceFileId: integer("sentence_file_id").notNull(),
	learnCount: integer("learn_count").default(0),
	totalDuration: integer("total_duration").default(0), // 秒
	totalScore: doublePrecision("total_score").default(0),
	lastSentenceIndex: integer("last_sentence_index").default(0), // 上次学习到的句子索引
	lastLearnedAt: timestamp("last_learned_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("file_learning_summary_user_id_idx").on(table.userId),
	index("file_learning_summary_sentence_file_id_idx").on(table.sentenceFileId),
	unique("file_learning_summary_user_file_key").on(table.userId, table.sentenceFileId),
]);

// ========== 句库分享系统 ==========

// 分享的句库表
export const sharedSentenceFiles = pgTable("shared_sentence_files", {
	id: serial().primaryKey().notNull(),
	sentenceFileId: integer("sentence_file_id").notNull(),
	sharedBy: varchar("shared_by", { length: 36 }).notNull(), // 分享者用户ID
	title: varchar("title", { length: 255 }).notNull(),
	description: text(),
	downloadCount: integer("download_count").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("shared_sentence_files_sentence_file_id_idx").on(table.sentenceFileId),
	index("shared_sentence_files_shared_by_idx").on(table.sharedBy),
	index("shared_sentence_files_created_at_idx").on(table.createdAt),
	foreignKey({
		columns: [table.sentenceFileId],
		foreignColumns: [sentenceFiles.id],
		name: "shared_sentence_files_sentence_file_id_fkey"
	}),
]);

// ========== 原有表 ==========

export const materials = pgTable("materials", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	audioUrl: text("audio_url").notNull(),
	duration: integer().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	fullText: text("full_text").default(''),
	status: varchar({ length: 20 }).default('pending'),
});

export const sentences = pgTable("sentences", {
	id: serial().primaryKey().notNull(),
	materialId: integer("material_id").notNull(),
	sentenceIndex: integer("sentence_index").notNull(),
	text: text().notNull(),
	startTime: integer("start_time").default(0),
	endTime: integer("end_time").default(0),
	audioUrl: text("audio_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_sentences_material_id").using("btree", table.materialId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "sentences_material_id_fkey"
		}).onDelete("cascade"),
]);

export const learningRecords = pgTable("learning_records", {
	id: serial().primaryKey().notNull(),
	sentenceId: integer("sentence_id").notNull(),
	attempts: integer().default(0),
	isCompleted: boolean("is_completed").default(false),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_learning_records_sentence_id").using("btree", table.sentenceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.sentenceId],
			foreignColumns: [sentences.id],
			name: "learning_records_sentence_id_fkey"
		}).onDelete("cascade"),
]);

export const pronunciationLearning = pgTable("pronunciation_learning", {
	id: serial().primaryKey().notNull(),
	deviceId: varchar("device_id", { length: 255 }).notNull(),
	materialId: integer("material_id").notNull(),
	recognizedText: varchar("recognized_text", { length: 255 }).notNull(),
	correctText: varchar("correct_text", { length: 255 }).notNull(),
	isCorrect: boolean("is_correct").default(false),
	similarityScore: doublePrecision("similarity_score").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_pronunciation_learning_device").using("btree", table.deviceId.asc().nullsLast().op("text_ops")),
]);

export const pronunciationMapping = pgTable("pronunciation_mapping", {
	id: serial().primaryKey().notNull(),
	deviceId: varchar("device_id", { length: 255 }).notNull(),
	originalSound: varchar("original_sound", { length: 50 }).notNull(),
	recognizedAs: varchar("recognized_as", { length: 50 }).notNull(),
	correctAs: varchar("correct_as", { length: 50 }).notNull(),
	occurrenceCount: integer("occurrence_count").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_pronunciation_mapping_device").using("btree", table.deviceId.asc().nullsLast().op("text_ops")),
	unique("pronunciation_mapping_device_id_original_sound_recognized_a_key").on(table.deviceId, table.originalSound, table.recognizedAs),
]);

export const sentenceFiles = pgTable("sentence_files", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	originalAudioUrl: text("original_audio_url"),
	originalDuration: integer("original_duration").default(0),
	sourceType: varchar("source_type", { length: 20 }).default('upload'),
	sourceUrl: text("source_url"),
	textContent: text("text_content"),
	status: varchar({ length: 20 }).default('pending'),
	createdBy: varchar("created_by", { length: 36 }), // 创建者用户ID
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("sentence_files_created_by_idx").on(table.createdBy),
]);

export const sentenceFileItems = pgTable("sentence_file_items", {
	id: serial().primaryKey().notNull(),
	sentenceFileId: integer("sentence_file_id").notNull(),
	sentenceIndex: integer("sentence_index").notNull(),
	text: text().notNull(),
	startTime: integer("start_time").default(0),
	endTime: integer("end_time").default(0),
	audioUrl: text("audio_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_sentence_file_items_file_id").using("btree", table.sentenceFileId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.sentenceFileId],
			foreignColumns: [sentenceFiles.id],
			name: "sentence_file_items_sentence_file_id_fkey"
		}).onDelete("cascade"),
]);

// ========== 社区系统 ==========

// 打卡记录表
export const checkIns = pgTable("check_ins", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	checkDate: varchar("check_date", { length: 10 }).notNull(), // YYYY-MM-DD
	streakDays: integer("streak_days").default(1), // 当次打卡时的连续天数
	durationSeconds: integer("duration_seconds").default(0), // 当日学习时长
	sentencesCompleted: integer("sentences_completed").default(0), // 当日完成句子数
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("check_ins_user_id_idx").on(table.userId),
	index("check_ins_check_date_idx").on(table.checkDate),
	unique("check_ins_user_date_key").on(table.userId, table.checkDate),
]);

// 徽章定义表
export const badges = pgTable("badges", {
	id: serial().primaryKey().notNull(),
	code: varchar("code", { length: 50 }).notNull().unique(),
	name: varchar("name", { length: 100 }).notNull(),
	description: text(),
	icon: varchar("icon", { length: 255 }), // 图标名称或URL
	type: varchar("type", { length: 20 }).default('streak'), // streak / achievement / special
	requirement: integer("requirement").default(0), // 达成条件数值
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户徽章表
export const userBadges = pgTable("user_badges", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	badgeId: integer("badge_id").notNull(),
	earnedAt: timestamp("earned_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("user_badges_user_id_idx").on(table.userId),
	unique("user_badges_user_badge_key").on(table.userId, table.badgeId),
	foreignKey({
		columns: [table.badgeId],
		foreignColumns: [badges.id],
		name: "user_badges_badge_id_fkey"
	}),
]);

// 话题表
export const topics = pgTable("topics", {
	id: serial().primaryKey().notNull(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	isPinned: boolean("is_pinned").default(false), // 是否置顶
	postCount: integer("post_count").default(0),
	createdBy: varchar("created_by", { length: 36 }), // 创建者（null为官方话题）
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("topics_is_active_idx").on(table.isActive),
	index("topics_is_pinned_idx").on(table.isPinned),
]);

// 动态/帖子表
export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	topicId: integer("topic_id"), // 所属话题（可选）
	content: text().notNull(),
	postType: varchar("post_type", { length: 20 }).default('dynamic'), // dynamic / share / achievement
	// 自动生成的动态相关数据
	metadata: text("metadata"), // JSON 格式的附加数据，如学习时长、完成句子数等
	likeCount: integer("like_count").default(0),
	commentCount: integer("comment_count").default(0),
	isHidden: boolean("is_hidden").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("posts_user_id_idx").on(table.userId),
	index("posts_topic_id_idx").on(table.topicId),
	index("posts_created_at_idx").on(table.createdAt),
	foreignKey({
		columns: [table.topicId],
		foreignColumns: [topics.id],
		name: "posts_topic_id_fkey"
	}),
]);

// 评论表
export const comments = pgTable("comments", {
	id: serial().primaryKey().notNull(),
	postId: integer("post_id").notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	parentId: integer("parent_id"), // 父评论ID（用于回复功能）
	content: text().notNull(),
	likeCount: integer("like_count").default(0),
	isHidden: boolean("is_hidden").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("comments_post_id_idx").on(table.postId),
	index("comments_user_id_idx").on(table.userId),
	index("comments_parent_id_idx").on(table.parentId),
	foreignKey({
		columns: [table.postId],
		foreignColumns: [posts.id],
		name: "comments_post_id_fkey"
	}).onDelete("cascade"),
]);

// 点赞表
export const likes = pgTable("likes", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	targetType: varchar("target_type", { length: 20 }).notNull(), // post / comment
	targetId: integer("target_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("likes_user_id_idx").on(table.userId),
	index("likes_target_idx").on(table.targetType, table.targetId),
	unique("likes_user_target_key").on(table.userId, table.targetType, table.targetId),
]);

// 用户资料扩展表（用于排行榜显示）
export const userProfiles = pgTable("user_profiles", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().unique(),
	nickname: varchar("nickname", { length: 100 }),
	avatarUrl: text("avatar_url"),
	bio: text(), // 个人简介
	showInRanking: boolean("show_in_ranking").default(true), // 是否显示在排行榜
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("user_profiles_user_id_idx").on(table.userId),
]);
