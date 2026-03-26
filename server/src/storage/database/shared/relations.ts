import { relations } from "drizzle-orm/relations";
import { materials, sentences, learningRecords, sentenceFiles, sentenceFileItems } from "./schema";

export const sentencesRelations = relations(sentences, ({one, many}) => ({
	material: one(materials, {
		fields: [sentences.materialId],
		references: [materials.id]
	}),
	learningRecords: many(learningRecords),
}));

export const materialsRelations = relations(materials, ({many}) => ({
	sentences: many(sentences),
}));

export const learningRecordsRelations = relations(learningRecords, ({one}) => ({
	sentence: one(sentences, {
		fields: [learningRecords.sentenceId],
		references: [sentences.id]
	}),
}));

export const sentenceFileItemsRelations = relations(sentenceFileItems, ({one}) => ({
	sentenceFile: one(sentenceFiles, {
		fields: [sentenceFileItems.sentenceFileId],
		references: [sentenceFiles.id]
	}),
}));

export const sentenceFilesRelations = relations(sentenceFiles, ({many}) => ({
	sentenceFileItems: many(sentenceFileItems),
}));