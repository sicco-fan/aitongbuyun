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
