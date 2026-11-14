# operator_own_agent_directives (applied to I KING on 2026-11-14 via apply_migration)
New tables: operator_directives, operator_agent_prefs (RLS on, no policies; access only through functions).
New functions: _my_active_company (internal), operator_my_agent, operator_send_directive, operator_cancel_directive,
operator_set_agent_prefs, admin_list_operator_directives, admin_cancel_operator_directive.
Tested in a rolled-back transaction: operator A sees only his own, operator B sees none and cannot cancel A's,
non-admin blocked from admin list, bad airport code and too-short body rejected.
Rollback: drop the 6 functions above, then drop tables operator_agent_prefs and operator_directives.
The agent does NOT read these directives yet (stored, visible to admin, cancellable). Consuming them is a separate step.
