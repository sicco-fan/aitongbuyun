import { pgTable, serial, timestamp, varchar, text, integer, index, foreignKey, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const materials = pgTable("materials", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	audioUrl: text("audio_url").notNull(),
	duration: integer().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
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

// 句库制作 - 句库文件表
export const sentenceFiles = pgTable("sentence_files", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	// 原始音频URL（存储对象存储key）
	originalAudioUrl: text("original_audio_url"),
	// 原始音频时长（毫秒）
	originalDuration: integer("original_duration").default(0),
	// 来源类型：upload（上传文件）、link（链接导入）
	sourceType: varchar("source_type", { length: 20 }).default('upload'),
	// 来源链接（如果是链接导入）
	sourceUrl: text("source_url"),
	// 提取的文本内容（完整段落）
	textContent: text("text_content"),
	// 状态：pending（待处理）、audio_ready（音频就绪）、text_ready（文本就绪）、completed（已完成）
	status: varchar({ length: 20 }).default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

// 句库制作 - 句子项目表
export const sentenceFileItems = pgTable("sentence_file_items", {
	id: serial().primaryKey().notNull(),
	sentenceFileId: integer("sentence_file_id").notNull(),
	// 句子索引
	sentenceIndex: integer("sentence_index").notNull(),
	// 句子文本
	text: text().notNull(),
	// 开始时间（毫秒）
	startTime: integer("start_time").default(0),
	// 结束时间（毫秒）
	endTime: integer("end_time").default(0),
	// 句子音频片段URL（存储对象存储key）
	audioUrl: text("audio_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_sentence_file_items_file_id").using("btree", table.sentenceFileId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.sentenceFileId],
			foreignColumns: [sentenceFiles.id],
			name: "sentence_file_items_file_id_fkey"
		}).onDelete("cascade"),
]);
