import type { paths } from "./openapi";
import { patch, request } from "./client";
import type { MeResponse } from "../types";

type JsonResponse<Operation> = Operation extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

type GetOperation<Path extends keyof paths> = paths[Path] extends { get: infer Op } ? Op : never;

type PatchOperation<Path extends keyof paths> = paths[Path] extends { patch: infer Op }
  ? Op
  : never;

export type TypedGetResponse<Path extends keyof paths> = JsonResponse<GetOperation<Path>>;

export type TypedPatchResponse<Path extends keyof paths> = JsonResponse<PatchOperation<Path>>;

/** Typed GET wrapper — expand pilot endpoints here before migrating hand-written api/*.ts */
export function typedGet<Path extends keyof paths>(
  path: Path
): Promise<TypedGetResponse<Path>> {
  return request(path as string);
}

/** Typed PATCH wrapper */
export function typedPatch<Path extends keyof paths>(
  path: Path,
  body?: unknown
): Promise<TypedPatchResponse<Path>> {
  return patch(path as string, body);
}

/** Pilot: identity endpoints backed by OpenAPI path types */
export const typedIdentity = {
  getMe: (): Promise<MeResponse> =>
    typedGet("/api/me") as Promise<MeResponse>,
  refreshTelegramProfile: (): Promise<MeResponse> =>
    typedPatch("/api/me/refresh-telegram-profile") as Promise<MeResponse>
};