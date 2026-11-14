import type { Handler } from './types.ts';
import { CmdError } from '../errors.ts';
import { applyDailyCare, saigonDateString, speciesById, stageFromCareDays } from '../../shared/vuon.ts';

const UPSERT = `
INSERT INTO garden_care(member_id, species_id, care_days, last_care_on)
VALUES(?,?,?,?)
ON CONFLICT(member_id, species_id) DO UPDATE SET
  care_days = MAX(garden_care.care_days, excluded.care_days),
  last_care_on = CASE
    WHEN excluded.care_days > garden_care.care_days THEN excluded.last_care_on
    ELSE garden_care.last_care_on
  END
`;

export const vuonCare: Handler = ({ db, member }, args) => {
  const species = speciesById(String(args.speciesId ?? ''));
  if (!species) throw new CmdError('not_found');

  const ownerId = args.ownerId ? String(args.ownerId) : member.id;
  if (ownerId !== member.id) {
    if (species.kind !== 'plant') throw new CmdError('forbidden');
    const owner = db.prepare(`SELECT disabled FROM members WHERE id = ?`).get(ownerId) as
      | { disabled: number }
      | undefined;
    if (!owner || owner.disabled) throw new CmdError('not_found');
  }

  const today = saigonDateString(new Date());
  const prev = db
    .prepare(
      `SELECT care_days AS careDays, last_care_on AS lastCareOn
       FROM garden_care WHERE member_id = ? AND species_id = ?`,
    )
    .get(ownerId, species.id) as { careDays: number; lastCareOn: string | null } | undefined;

  const before = prev?.careDays ?? 0;
  const next = applyDailyCare({ careDays: before, lastCareOn: prev?.lastCareOn ?? null }, today);

  db.prepare(UPSERT).run(ownerId, species.id, next.careDays, next.lastCareOn);

  const stored = db
    .prepare(
      `SELECT care_days AS careDays, last_care_on AS lastCareOn
       FROM garden_care WHERE member_id = ? AND species_id = ?`,
    )
    .get(ownerId, species.id) as { careDays: number; lastCareOn: string };

  const counted = stored.careDays > before;
  if (counted) {
    db.prepare(`UPDATE garden_meta SET version = version + 1 WHERE id = 1`).run();
  }

  return {
    result: {
      ownerId,
      speciesId: species.id,
      kind: species.kind,
      careDays: stored.careDays,
      lastCareOn: stored.lastCareOn,
      counted,
      stage: stageFromCareDays(stored.careDays),
    },
    scopes: counted ? ['vuon'] : [],
  };
};
