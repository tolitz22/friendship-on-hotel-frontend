# Phase 65F — Financial acceptance gate

## Scope and safety
Use Client Demo only, with an authorized cashier, employee, and independent manager. Verify property identity before any writes. Never use real customer or supplier data. Use unique QA references, capture initial balances, and retain audit records; do not delete or directly edit posted transactions. Amounts below are synthetic PHP examples, not instructions to change real balances.

## Acceptance scenarios (live results pending)
| ID | Scenario | Expected result |
| --- | --- | --- |
| F01 | Open demo shift and record routine PHP 200 drawer expense | Expected cash falls by PHP 200 once; voucher and journal agree |
| F02 | Record PHP 300 bank and PHP 400 card expenses | Both appear in expense register; no drawer movement |
| F03 | Retry an identical payout with same request key | Same transaction returned; no second journal or payout |
| F04 | Above-limit expense and independent review | Policy enforced; unauthorized/self review denied |
| F05 | Correct a posted expense and return PHP 50 cash via approved workflow | Original audit history retained; drawer increases only on actual return |
| F06 | Record PHP 1,000 supplier invoice; pay PHP 400 from drawer and PHP 600 from bank | Payable 1,000 → 600 → 0; drawer falls only by 400; no duplicate expense recognition |
| F07 | Employee submits PHP 500 claim; independent reviewer approves; reimburse PHP 200 from drawer and PHP 300 from bank | Approved liability 500 → 300 → 0; drawer falls only by 200; claim owner and role restrictions enforced |
| F08 | Attempt direct cross-property access and posting to closed shift/date | Rejected; no side effects |
| F09 | Count physical demo cash, close and reconcile shift | Expected balance agrees with opening cash and all actual cash movements; variance independently reviewed if present |
| F10 | Run Daily Closing preflight, inspect daily expense breakdown and historical supplier/employee liabilities | Open shifts block close; reports reconcile; prior-date liabilities unchanged by later payment |
| F11 | Check register, record modal, details, claim and supplier views at desktop and mobile widths | No clipped controls; accessible labels, focus and validation; correct status and payment source |
| F12 | Print expense voucher | Reference, amount, payment source, approval status and transaction history agree with stored facts; no clipped or missing content |

## Evidence to capture
Record property, business date, actor role, synthetic reference, transaction ID, expected and observed balances, journal/report references, actual outcome, screenshots where safe, and retest result. Do not include credentials or personal data.

## Release gate
All P1 financial scenarios F01–F10 must pass against the deployed build, with no unexplained discrepancy. F11–F12 must pass before final sign-off. CI must be green on exact deployed frontend and backend revisions. A mock or unit pass is not live acceptance. If live access or evidence is unavailable, mark blocked, not passed.
