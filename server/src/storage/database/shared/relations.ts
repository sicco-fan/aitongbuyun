import { relations } from "drizzle-orm/relations";
import { materials, sentences, learningRecords, sentenceFiles, sentenceFileItems, users, checkIns, badges, userBadges, topics, posts, comments, likes, userProfiles } from "./schema";

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

// ========== 社区系统关系 ==========

export const usersRelations = relations(users, ({one, many}) => ({
	userProfile: one(userProfiles, {
		fields: [users.id],
		references: [userProfiles.userId]
	}),
	checkIns: many(checkIns),
	userBadges: many(userBadges),
	posts: many(posts),
	comments: many(comments),
	likes: many(likes),
}));

export const checkInsRelations = relations(checkIns, ({one}) => ({
	user: one(users, {
		fields: [checkIns.userId],
		references: [users.id]
	}),
}));

export const badgesRelations = relations(badges, ({many}) => ({
	userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({one}) => ({
	user: one(users, {
		fields: [userBadges.userId],
		references: [users.id]
	}),
	badge: one(badges, {
		fields: [userBadges.badgeId],
		references: [badges.id]
	}),
}));

export const topicsRelations = relations(topics, ({many}) => ({
	posts: many(posts),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	topic: one(topics, {
		fields: [posts.topicId],
		references: [topics.id]
	}),
	comments: many(comments),
}));

export const commentsRelations = relations(comments, ({one}) => ({
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [comments.userId],
		references: [users.id]
	}),
	parent: one(comments, {
		fields: [comments.parentId],
		references: [comments.id]
	}),
}));

export const likesRelations = relations(likes, ({one}) => ({
	user: one(users, {
		fields: [likes.userId],
		references: [users.id]
	}),
}));

export const userProfilesRelations = relations(userProfiles, ({one}) => ({
	user: one(users, {
		fields: [userProfiles.userId],
		references: [users.id]
	}),
}));