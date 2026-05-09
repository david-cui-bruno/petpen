import Link from "next/link";
import {
  dischargeStay,
  hideStay,
  releaseClaim,
} from "./actions";
import type { CoordinatorRow } from "@/lib/queries";

const STATUS_FILTERS = [
  "all",
  "intook",
  "available",
  "claimed",
  "fostered",
  "discharged",
  "hidden",
];

export function CoordinatorTable({
  rows,
  currentStatus,
}: {
  rows: CoordinatorRow[];
  currentStatus: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-base">Status:</span>
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/coordinator" : `/coordinator?status=${s}`}
            className={`font-pixel text-[10px] px-3 py-1 border-2 ${
              currentStatus === s
                ? "bg-grass text-parchment border-wood-dark"
                : "bg-white text-wood-dark border-wood-dark hover:bg-parchment-dark"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xl italic">No stays match this filter.</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <li key={row.stay_id}>
                <CoordinatorCard row={row} />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-2 border-wood-dark text-xl bg-parchment">
              <thead className="bg-wood text-parchment font-pixel text-[10px]">
                <tr>
                  <th className="px-2 py-2 text-left">Pet</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Intook</th>
                  <th className="px-2 py-2 text-left">Returns</th>
                  <th className="px-2 py-2 text-left">Owner</th>
                  <th className="px-2 py-2 text-left">Foster</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <CoordinatorRowView key={row.stay_id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CoordinatorRowView({ row }: { row: CoordinatorRow }) {
  const isTerminal = row.status === "discharged" || row.status === "hidden";
  const isClaimed = row.status === "claimed" || row.status === "fostered";

  return (
    <tr className="border-t-2 border-wood-dark/30 align-top">
      <td className="px-2 py-2">
        <Link href={`/pets/${row.pet_id}`} className="underline">
          {row.pet_name}
        </Link>
        <div className="text-base text-wood">
          {row.breed} · {row.species}
        </div>
      </td>
      <td className="px-2 py-2">{row.status}</td>
      <td className="px-2 py-2">{shortDate(row.intook_at)}</td>
      <td className="px-2 py-2">{row.expected_return}</td>
      <td className="px-2 py-2">
        {row.owner_first_name}
        <div className="text-base text-wood">{row.owner_phone}</div>
      </td>
      <td className="px-2 py-2">
        {row.foster_first_name ? (
          <>
            {row.foster_first_name}
            <div className="text-base text-wood">{row.foster_phone}</div>
            {row.foster_commitment && (
              <div className="text-base text-wood">
                ({prettyCommitment(row.foster_commitment)})
              </div>
            )}
          </>
        ) : (
          <span className="text-wood">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <ActionButtons row={row} isTerminal={isTerminal} isClaimed={isClaimed} />
      </td>
    </tr>
  );
}

function CoordinatorCard({ row }: { row: CoordinatorRow }) {
  const isTerminal = row.status === "discharged" || row.status === "hidden";
  const isClaimed = row.status === "claimed" || row.status === "fostered";

  return (
    <div className="panel-parchment p-3 text-xl space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/pets/${row.pet_id}`}
          className="font-pixel text-xs text-wood-dark underline truncate"
        >
          {row.pet_name}
        </Link>
        <span className="text-base bg-wood-light text-wood-dark px-2 py-0.5">
          {row.status}
        </span>
      </div>
      <div className="text-base text-wood">
        {row.breed} · {row.species}
      </div>
      <div className="text-base">
        Intook {shortDate(row.intook_at)} → returns {row.expected_return}
      </div>
      <div className="text-base">
        Owner: {row.owner_first_name}
        <span className="text-wood"> · {row.owner_phone}</span>
      </div>
      <div className="text-base">
        Foster:{" "}
        {row.foster_first_name ? (
          <>
            {row.foster_first_name}
            <span className="text-wood"> · {row.foster_phone}</span>
            {row.foster_commitment && (
              <span className="text-wood"> ({prettyCommitment(row.foster_commitment)})</span>
            )}
          </>
        ) : (
          <span className="text-wood">—</span>
        )}
      </div>
      <div className="pt-2">
        <ActionButtons row={row} isTerminal={isTerminal} isClaimed={isClaimed} />
      </div>
    </div>
  );
}

function ActionButtons({
  row,
  isTerminal,
  isClaimed,
}: {
  row: CoordinatorRow;
  isTerminal: boolean;
  isClaimed: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {!isTerminal && (
        <form action={dischargeStay.bind(null, row.stay_id)}>
          <button
            type="submit"
            className="font-pixel text-[9px] bg-grass-dark text-parchment px-2 py-1"
          >
            Discharge
          </button>
        </form>
      )}
      {isClaimed && (
        <form action={releaseClaim.bind(null, row.stay_id)}>
          <button
            type="submit"
            className="font-pixel text-[9px] bg-wood text-parchment px-2 py-1"
          >
            Release claim
          </button>
        </form>
      )}
      {!isTerminal && (
        <form action={hideStay.bind(null, row.stay_id)}>
          <button
            type="submit"
            className="font-pixel text-[9px] bg-red-700 text-parchment px-2 py-1"
          >
            Hide
          </button>
        </form>
      )}
    </div>
  );
}

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

function prettyCommitment(c: string): string {
  switch (c) {
    case "a_few_days":
      return "few days";
    case "about_a_week":
      return "1 wk";
    case "two_weeks":
      return "2 wks";
    case "three_weeks":
      return "3 wks";
    case "full_stay":
      return "full stay";
    default:
      return c;
  }
}
