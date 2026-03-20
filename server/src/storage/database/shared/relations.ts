import { relations } from "drizzle-orm/relations";
import { materials, sentences, learningRecords } from "./schema";

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