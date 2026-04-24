import type { ModelConfig } from "./schemas";

export type ModelRole = "attacker" | "benign" | "judge";

// Filter models by role tag. Catalog-seeded rows carry role tags matching their allowedRoles
// (see server/seed-cliproxy.ts). Legacy rows without any of the three role tags are treated as
// role-permissive (included in every dropdown) to preserve backward compatibility.
export function filterModelsByRole(models: ModelConfig[], role: ModelRole): ModelConfig[] {
	return models.filter((model) => {
		const tags = model.roleTags ?? [];
		const hasRoleTag = tags.includes("attacker") || tags.includes("benign") || tags.includes("judge");
		if (!hasRoleTag) return true;
		return tags.includes(role);
	});
}
