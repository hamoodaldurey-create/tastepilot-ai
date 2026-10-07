export type TasteType = "movie" | "artist" | "brand" | "book" | "place";
export type Category = "dining" | "travel" | "entertainment";
export interface Favorite { name: string; type: TasteType }
export interface Brief { favorites: Favorite[]; city: string; priceLevel: number; categories: Category[]; likedIds: string[]; excludedIds: string[] }
export interface Recommendation { id: string; name: string; category: Category; description: string; image?: string; url?: string; address?: string; tags: string[]; affinity?: number; priceLevel?: number; reason: string }
export interface AgentStep { tool: string; status: "complete" | "warning"; detail: string }
export interface PlanResult { recommendations: Recommendation[]; resolved: { input: string; name: string; id: string; type: string }[]; steps: AgentStep[]; warnings: string[]; generatedAt: string; city: string; mode: "live"; }
