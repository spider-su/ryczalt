import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RentalDocument } from "../model/rental";

const runtime = vi.hoisted(() => ({
  initialDocument: null as RentalDocument | null,
  empty: null as RentalDocument | null,
  permission: { granted: true, canAskAgain: true },
  pending: [] as { identifier: string; content: { data?: Record<string, unknown> }; trigger: unknown }[],
  onAppState: null as ((state: string) => void) | null,
  failNextSave: false,
  load: vi.fn(),
  save: vi.fn(),
  reset: vi.fn(),
  getPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getPending: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  setChannel: vi.fn(),
}));

vi.mock("../data/localRentalStore", () => ({
  emptyDocument: () => structuredClone(runtime.empty),
  loadRentalDocumentWithStatus: (...args: unknown[]) => runtime.load(...args),
  readRawRentalDocument: vi.fn(async () => null),
  resetRentalDocument: (...args: unknown[]) => runtime.reset(...args),
  saveRentalDocument: (...args: unknown[]) => runtime.save(...args),
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  getPermissionsAsync: (...args: unknown[]) => runtime.getPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => runtime.requestPermissions(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => runtime.getPending(...args),
  scheduleNotificationAsync: (...args: unknown[]) => runtime.schedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => runtime.cancel(...args),
  setNotificationChannelAsync: (...args: unknown[]) => runtime.setChannel(...args),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      runtime.onAppState = listener;
      return { remove: vi.fn() };
    }),
  },
  Linking: { openSettings: vi.fn(async () => undefined) },
}));

import { RentalDataProvider, useRentalData } from "../data/RentalDataProvider";
import { ReminderProvider, useReminders } from "./ReminderProvider";

function documentFixture(): RentalDocument {
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 70, 12);
  const leaseEndDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;
  const nextDue = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  return {
    schemaVersion: 1,
    properties: [{ id: "p-1", address: "Testowa", ownerRent: "3000.00", paymentDay: nextDue.getDate(), leaseEndDate }],
    incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], customReminders: [],
    taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [],
    settings: { taxYear: now.getFullYear(), settlementMode: "monthly", jointSpouseThreshold: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: false, custom: false }, rentReminderDelayDays: 0 },
  };
}

function emptyFixture(): RentalDocument {
  const empty = documentFixture();
  empty.properties = [];
  empty.incomeEntries = [];
  empty.taxPayments = [];
  empty.taskStates = [];
  return empty;
}

let actions: {
  update: (change: (document: RentalDocument) => RentalDocument) => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  resetLocalData: () => Promise<void>;
  requestPermission: () => Promise<string>;
} | null;

function Harness() {
  const rental = useRentalData();
  const reminders = useReminders();
  actions = { update: rental.update, enterDemoMode: rental.enterDemoMode, exitDemoMode: rental.exitDemoMode, resetLocalData: rental.resetLocalData, requestPermission: reminders.requestPermission };
  return null;
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderProviders() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RentalDataProvider><ReminderProvider><Harness /></ReminderProvider></RentalDataProvider>);
    await flushEffects();
    await flushEffects();
  });
  return renderer;
}

beforeEach(() => {
  vi.clearAllMocks();
  runtime.initialDocument = documentFixture();
  runtime.empty = emptyFixture();
  runtime.permission = { granted: true, canAskAgain: true };
  runtime.pending = [];
  runtime.onAppState = null;
  runtime.failNextSave = false;
  runtime.load.mockImplementation(async () => ({ document: structuredClone(runtime.initialDocument), recoveredFromBackup: false }));
  runtime.save.mockImplementation(async () => {
    if (runtime.failNextSave) { runtime.failNextSave = false; throw new Error("storage failed"); }
  });
  runtime.reset.mockResolvedValue(undefined);
  runtime.getPermissions.mockImplementation(async () => ({ ...runtime.permission }));
  runtime.requestPermissions.mockImplementation(async () => ({ ...runtime.permission }));
  runtime.getPending.mockImplementation(async () => structuredClone(runtime.pending));
  runtime.schedule.mockImplementation(async (request: { content: { data?: Record<string, unknown> }; trigger: unknown }) => {
    const identifier = `os-${runtime.pending.length + 1}`;
    runtime.pending.push({ identifier, content: structuredClone(request.content), trigger: structuredClone(request.trigger) });
    return identifier;
  });
  runtime.cancel.mockImplementation(async (identifier: string) => {
    runtime.pending = runtime.pending.filter((item) => item.identifier !== identifier);
  });
  runtime.setChannel.mockResolvedValue(null);
  actions = null;
});

describe("ReminderProvider committed-document integration", () => {
  it("reconciles after a persisted rent confirmation and does not schedule failed mutations", async () => {
    const renderer = await renderProviders();
    const rentKey = runtime.pending.find((item) => String(item.content.data?.reminderKey).startsWith("ryczalt:TENANT_PAYMENT_CHECK:group:"))?.content.data?.reminderKey;
    expect(rentKey).toBeDefined();
    const scheduledBefore = runtime.pending.length;

    runtime.failNextSave = true;
    await act(async () => {
      await expect(actions!.update((document) => ({ ...document, properties: [] }))).rejects.toThrow("Rental document could not be saved.");
      await flushEffects();
    });
    expect(runtime.pending).toHaveLength(scheduledBefore);
    expect(runtime.pending.some((item) => item.content.data?.reminderKey === rentKey)).toBe(true);

    await act(async () => {
      await actions!.update((document) => ({
        ...document,
        incomeEntries: [...document.incomeEntries, {
          id: "receipt-1", propertyId: "p-1", receivedAt: new Date().toISOString().slice(0, 10),
          rentalMonth: String(runtime.pending.find((item) => item.content.data?.reminderKey === rentKey)?.content.data?.period),
          amount: "3000.00", taxableAmount: "3000.00",
        }],
      }));
      await flushEffects();
      await flushEffects();
    });
    expect(runtime.pending.some((item) => item.content.data?.reminderKey === rentKey)).toBe(false);
    expect(runtime.save).toHaveBeenCalledTimes(2);
    await act(async () => renderer.unmount());
  });

  it("does not modify real schedules in demo mode and refreshes permission on app resume", async () => {
    runtime.permission = { granted: false, canAskAgain: false };
    const renderer = await renderProviders();
    expect(runtime.pending).toHaveLength(0);
    expect(runtime.onAppState).toBeTypeOf("function");

    runtime.permission = { granted: true, canAskAgain: true };
    await act(async () => {
      runtime.onAppState?.("active");
      await flushEffects();
      await flushEffects();
    });
    expect(runtime.pending.length).toBeGreaterThan(0);
    const realKeys = runtime.pending.map((item) => item.content.data?.reminderKey);

    await act(async () => { actions!.enterDemoMode(); await flushEffects(); });
    expect(runtime.pending.map((item) => item.content.data?.reminderKey)).toEqual(realKeys);
    await act(async () => { actions!.exitDemoMode(); await flushEffects(); });
    expect(new Set(runtime.pending.map((item) => item.content.data?.reminderKey)).size).toBe(runtime.pending.length);
    await act(async () => renderer.unmount());

    const schedulesAfterFirstLaunch = runtime.schedule.mock.calls.length;
    const restarted = await renderProviders();
    expect(new Set(runtime.pending.map((item) => item.content.data?.reminderKey)).size).toBe(runtime.pending.length);
    expect(runtime.schedule).toHaveBeenCalledTimes(schedulesAfterFirstLaunch);
    await act(async () => restarted.unmount());
  });

  it("reconciles an imported document and reset through the real data provider", async () => {
    const renderer = await renderProviders();
    const oldAgreementKey = runtime.pending.find((item) => String(item.content.data?.reminderKey).includes("RENTAL_AGREEMENT_END"))?.content.data?.reminderKey;
    expect(oldAgreementKey).toBeDefined();
    const restored = structuredClone(runtime.initialDocument!);
    restored.properties[0]!.id = "restored-apartment";

    await act(async () => {
      await actions!.update(() => restored);
      await flushEffects();
      await flushEffects();
    });
    expect(runtime.pending.some((item) => item.content.data?.reminderKey === oldAgreementKey)).toBe(false);
    expect(runtime.pending.some((item) => String(item.content.data?.reminderKey).includes("RENTAL_AGREEMENT_END:restored-apartment"))).toBe(true);

    await act(async () => { await actions!.resetLocalData(); await flushEffects(); await flushEffects(); });
    expect(runtime.reset).toHaveBeenCalledOnce();
    expect(runtime.pending).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});
