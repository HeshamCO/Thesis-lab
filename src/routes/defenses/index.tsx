import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";
import type { DefenseConfig, DefenseConfigInput, DefenseMode } from "#/lib/thesis/schemas";

export const Route = createFileRoute("/defenses/")({ component: DefensesPage });

const emptyDefense: DefenseConfigInput = {
	name: "",
	mode: "none",
	defensivePrompt: "",
	blockedPatterns: [],
	retrievalFilterEnabled: false,
};

function DefensesPage() {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<DefenseConfigInput>(emptyDefense);
	const queryClient = useQueryClient();
	const defenses = useQuery({
		queryKey: queryKeys.defenses,
		queryFn: api.defenses,
	});
	const saveDefense = useMutation({
		mutationFn: (input: DefenseConfigInput) =>
			editingId ? api.updateDefense(editingId, input) : api.createDefense(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.defenses });
			toast.success(editingId ? "Defense updated" : "Defense created");
			setEditingId(null);
			setForm(emptyDefense);
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteDefense = useMutation({
		mutationFn: api.deleteDefense,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.defenses });
			toast.success("Defense deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<PageHeading
				title="Defense configurations"
				description="Define prompt guards and retrieval filters to compare against the no-defense baseline."
			/>

			<Card>
				<CardHeader>
					<CardTitle>{editingId ? "Edit defense" : "Create defense"}</CardTitle>
					<CardDescription>Blocked patterns are case-insensitive regular expressions.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-2"
						onSubmit={(event) => {
							event.preventDefault();
							saveDefense.mutate(form);
						}}
					>
						<Field label="Name">
							<Input
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
								required
							/>
						</Field>
						<Field label="Mode">
							<Select value={form.mode} onValueChange={(value) => setForm({ ...form, mode: value as DefenseMode })}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="none">None</SelectItem>
										<SelectItem value="prompt_guard">Prompt guard</SelectItem>
										<SelectItem value="retrieval_filter">Retrieval filter</SelectItem>
										<SelectItem value="combined">Combined</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field label="Defensive prompt">
							<Textarea
								value={form.defensivePrompt}
								onChange={(event) =>
									setForm({
										...form,
										defensivePrompt: event.currentTarget.value,
									})
								}
							/>
						</Field>
						<Field label="Blocked patterns">
							<Textarea
								value={form.blockedPatterns.join("\n")}
								onChange={(event) =>
									setForm({
										...form,
										blockedPatterns: splitLines(event.currentTarget.value),
									})
								}
							/>
						</Field>
						<label className="flex items-center gap-2 text-sm md:col-span-2">
							<Checkbox
								checked={form.retrievalFilterEnabled}
								onCheckedChange={(checked) =>
									setForm({
										...form,
										retrievalFilterEnabled: checked === true,
									})
								}
							/>
							Enable retrieval filtering even when mode is prompt guard
						</label>
						<div className="flex gap-2 md:col-span-2">
							<Button type="submit" disabled={saveDefense.isPending}>
								<SaveIcon data-icon="inline-start" />
								{editingId ? "Save defense" : "Create defense"}
							</Button>
							{editingId ? (
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setEditingId(null);
										setForm(emptyDefense);
									}}
								>
									Cancel
								</Button>
							) : null}
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configured defenses</CardTitle>
					<CardDescription>Defense snapshots are copied into each run at launch time.</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Patterns</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(defenses.data ?? []).map((defense) => (
								<TableRow key={defense.id}>
									<TableCell>{defense.name}</TableCell>
									<TableCell>{defense.mode}</TableCell>
									<TableCell>{defense.blockedPatterns.length}</TableCell>
									<TableCell>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setEditingId(defense.id);
													setForm(toDefenseInput(defense));
												}}
											>
												Edit
											</Button>
											<Button variant="ghost" size="sm" onClick={() => deleteDefense.mutate(defense.id)}>
												<Trash2Icon data-icon="inline-start" />
												Delete
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-2">
			<Label>{label}</Label>
			{children}
		</label>
	);
}

function splitLines(value: string) {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function toDefenseInput(defense: DefenseConfig): DefenseConfigInput {
	return {
		name: defense.name,
		mode: defense.mode,
		defensivePrompt: defense.defensivePrompt,
		blockedPatterns: defense.blockedPatterns,
		retrievalFilterEnabled: defense.retrievalFilterEnabled,
	};
}
