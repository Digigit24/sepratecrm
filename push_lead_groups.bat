@echo off
echo ========================================
echo  Pushing Lead Groups feature to telecmi
echo ========================================

cd /d C:\xampp\htdocs\crmwhatsapp\sepratecrm

:: Remove stale lock if exists
if exist .git\index.lock del /f .git\index.lock

git config user.email "dgtechsolutions23@gmail.com"
git config user.name "Digitech"

git add -A
git commit -m "feat: add Lead Groups feature

- Add LeadGroup, LeadGroupMinimal types and related payload/response types
- Add LEAD_GROUP_* endpoints to apiConfig
- Add group CRUD and membership service methods to crmService
- Add useLeadGroups hook and mutation callbacks to useCRM
- Add CRMLeadGroups management page with DataTable, Create/Edit dialog, Delete AlertDialog
- Add LeadGroupsSelector component for lead drawer group assignment
- Inject LeadGroupsSelector into LeadsFormDrawer details tab
- Add group_select filter type to filterTypes and LeadsFilterDrawer
- Add bulk Add to Group action to CRMLeads page
- Add Lead Groups sidebar nav item to UniversalSidebar
- Add /crm/groups route in App.tsx"

git push origin telecmi

echo.
echo ========================================
echo  Frontend push complete!
echo ========================================
echo.
echo ========================================
echo  Pushing Lead Groups backend to main
echo ========================================

cd /d C:\ritik\AAAAA\digicrm

git config user.email "dgtechsolutions23@gmail.com"
git config user.name "Digitech"

git add -A
git commit -m "feat: add Lead Groups feature

- Add LeadGroup model with tenant_id, name, description, color_hex, created_by
- Add LeadGroupMembership through-table (group, lead, added_by, added_at)
- Add ManyToManyField Lead.groups through LeadGroupMembership
- Add LeadGroupSerializer (with lead_count annotation), LeadGroupMinimalSerializer
- Add BulkLeadGroupMembershipSerializer for bulk add/remove
- Update LeadSerializer and LeadListSerializer with groups field
- Add LeadGroupViewSet with add-leads, remove-leads, leads custom actions
- Register lead-groups router in crm/urls.py
- Add migration 0004_lead_groups.py"

git push origin main

echo.
echo ========================================
echo  Backend push complete! All done.
echo ========================================
pause
