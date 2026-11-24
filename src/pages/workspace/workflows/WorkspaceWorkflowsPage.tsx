import {useFocusEffect} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import ApprovalWorkflowSection from '@components/ApprovalWorkflowSection';
import ConfirmModal from '@components/ConfirmModal';
import getBankIcon from '@components/Icon/BankIcons';
import type {BankName} from '@components/Icon/BankIconsUtils';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import MenuItem from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Section from '@components/Section';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import {getPaymentMethodDescription} from '@libs/PaymentUtils';
import * as PersonalDetailsUtils from '@libs/PersonalDetailsUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import {convertPolicyEmployeesToApprovalWorkflows, INITIAL_APPROVAL_WORKFLOW} from '@libs/WorkflowUtils';
import type {FullScreenNavigatorParamList} from '@navigation/types';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import withPolicy from '@pages/workspace/withPolicy';
import WorkspacePageWithSections from '@pages/workspace/WorkspacePageWithSections';
import * as Policy from '@userActions/Policy/Policy';
import {navigateToBankAccountRoute} from '@userActions/ReimbursementAccount';
import * as Workflow from '@userActions/Workflow';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import ToggleSettingOptionRow from './ToggleSettingsOptionRow';
import type {ToggleSettingOptionRowProps} from './ToggleSettingsOptionRow';
import {getAutoReportingFrequencyDisplayNames} from './WorkspaceAutoReportingFrequencyPage';
import type {AutoReportingFrequencyKey} from './WorkspaceAutoReportingFrequencyPage';

type WorkspaceWorkflowsPageProps = WithPolicyProps & StackScreenProps<FullScreenNavigatorParamList, typeof SCREENS.WORKSPACE.WORKFLOWS>;

function WorkspaceWorkflowsPage({policy, route}: WorkspaceWorkflowsPageProps) {
    const {translate, preferredLocale} = useLocalize();
    const theme = useTheme();
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout, isSmallScreenWidth} = useResponsiveLayout();

    const policyApproverEmail = policy?.approver;
    const containerStyle = useMemo(() => [styles.ph8, styles.mhn8, styles.ml11, styles.pv3, styles.pr0, styles.pl4, styles.mr0, styles.widthAuto, styles.mt4], [styles]);
    const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST);
    const {approvalWorkflows, availableMembers, usedApproverEmails} = useMemo(
        () =>
            convertPolicyEmployeesToApprovalWorkflows({
                employees: policy?.employeeList ?? {},
                defaultApprover: policyApproverEmail ?? policy?.owner ?? '',
                personalDetails: personalDetails ?? {},
            }),
        [personalDetails, policy?.employeeList, policy?.owner, policyApproverEmail],
    );
    const displayNameForAuthorizedPayer = useMemo(
        () => PersonalDetailsUtils.getPersonalDetailByEmail(policy?.achAccount?.reimburser ?? '')?.displayName ?? policy?.achAccount?.reimburser,
        [policy?.achAccount?.reimburser],
    );

    const onPressAutoReportingFrequency = useCallback(() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_AUTOREPORTING_FREQUENCY.getRoute(route.params.policyID)), [route.params.policyID]);

    const fetchData = useCallback(() => {
        Policy.openPolicyWorkflowsPage(route.params.policyID);
    }, [route.params.policyID]);

    const confirmCurrencyChangeAndHideModal = useCallback(() => {
        if (!policy) {
            return;
        }
        Policy.updateGeneralSettings(policy.id, policy.name, CONST.CURRENCY.USD);
        setIsCurrencyModalOpen(false);
        navigateToBankAccountRoute(route.params.policyID, ROUTES.WORKSPACE_WORKFLOWS.getRoute(route.params.policyID));
    }, [policy, route.params.policyID]);

    const {isOffline} = useNetwork({onReconnect: fetchData});
    const isPolicyAdmin = PolicyUtils.isPolicyAdmin(policy);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData]),
    );

    // User should be allowed to add new Approval Workflow only if he's upgraded to Control Plan, otherwise redirected to the Upgrade Page
    const addApprovalAction = useCallback(() => {
        if (!PolicyUtils.isControlPolicy(policy)) {
            Navigation.navigate(
                ROUTES.WORKSPACE_UPGRADE.getRoute(route.params.policyID, CONST.UPGRADE_FEATURE_INTRO_MAPPING.approvals.alias, ROUTES.WORKSPACE_WORKFLOWS.getRoute(route.params.policyID)),
            );
            return;
        }

        Workflow.setApprovalWorkflow({
            ...INITIAL_APPROVAL_WORKFLOW,
            availableMembers,
            usedApproverEmails,
        });
        Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_APPROVALS_EXPENSES_FROM.getRoute(route.params.policyID));
    }, [policy, route.params.policyID, availableMembers, usedApproverEmails]);

    const optionItems: ToggleSettingOptionRowProps[] = useMemo(() => {
        const {accountNumber, addressName, bankName} = policy?.achAccount ?? {};
        const hasVBA = !!policy?.achAccount;
        let bankDisplayName = bankName ?? addressName;
        if (accountNumber && bankDisplayName !== accountNumber) {
            bankDisplayName += ` ${accountNumber.slice(-5)}`;
        }
        const hasReimburserError = !!policy?.errorFields?.reimburser;
        const hasApprovalError = !!policy?.errorFields?.approvalMode;
        const hasDelayedSubmissionError = !!policy?.errorFields?.autoReporting ?? !!policy?.errorFields?.autoReportingFrequency;

        return [
            {
                title: translate('workflowsPage.delaySubmissionTitle'),
                subtitle: translate('workflowsPage.delaySubmissionDescription'),
                switchAccessibilityLabel: translate('workflowsPage.delaySubmissionDescription'),
                onToggle: (isEnabled: boolean) => {
                    Policy.setWorkspaceAutoReportingFrequency(
                        route.params.policyID,
                        isEnabled ? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.WEEKLY : CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT,
                    );
                },
                subMenuItems: (
                    <MenuItemWithTopDescription
                        title={
                            getAutoReportingFrequencyDisplayNames(preferredLocale)[
                                (PolicyUtils.getCorrectedAutoReportingFrequency(policy) as AutoReportingFrequencyKey) ?? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.WEEKLY
                            ]
                        }
                        titleStyle={styles.textNormalThemeText}
                        descriptionTextStyle={styles.textLabelSupportingNormal}
                        onPress={onPressAutoReportingFrequency}
                        // Instant submit is the equivalent of delayed submissions being turned off, so we show the feature as disabled if the frequency is instant
                        description={translate('workflowsPage.submissionFrequency')}
                        shouldShowRightIcon
                        wrapperStyle={[styles.sectionMenuItemTopDescription, styles.mt3, styles.mbn3]}
                        brickRoadIndicator={hasDelayedSubmissionError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    />
                ),
                isActive: (policy?.autoReportingFrequency !== CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT && !hasDelayedSubmissionError) ?? false,
                pendingAction: policy?.pendingFields?.autoReporting ?? policy?.pendingFields?.autoReportingFrequency,
                errors: ErrorUtils.getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.AUTOREPORTING),
                onCloseError: () => Policy.clearPolicyErrorField(route.params.policyID, CONST.POLICY.COLLECTION_KEYS.AUTOREPORTING),
            },
            {
                title: translate('workflowsPage.addApprovalsTitle'),
                subtitle: translate('workflowsPage.addApprovalsDescription'),
                switchAccessibilityLabel: translate('workflowsPage.addApprovalsDescription'),
                onToggle: (isEnabled: boolean) => {
                    Policy.setWorkspaceApprovalMode(route.params.policyID, policy?.owner ?? '', isEnabled ? CONST.POLICY.APPROVAL_MODE.BASIC : CONST.POLICY.APPROVAL_MODE.OPTIONAL);
                },
                subMenuItems: (
                    <>
                        {approvalWorkflows.map((workflow, index) => (
                            <OfflineWithFeedback
                                // eslint-disable-next-line react/no-array-index-key
                                key={`workflow-${index}`}
                                pendingAction={workflow.pendingAction}
                            >
                                <ApprovalWorkflowSection
                                    approvalWorkflow={workflow}
                                    onPress={() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_APPROVALS_EDIT.getRoute(route.params.policyID, workflow.approvers[0].email))}
                                />
                            </OfflineWithFeedback>
                        ))}
                        <MenuItem
                            title={translate('workflowsPage.addApprovalButton')}
                            titleStyle={styles.textStrong}
                            icon={Expensicons.Plus}
                            iconHeight={20}
                            iconWidth={20}
                            style={[styles.sectionMenuItemTopDescription, styles.mt6, styles.mbn3]}
                            onPress={addApprovalAction}
                        />
                    </>
                ),
                isActive:
                    ([CONST.POLICY.APPROVAL_MODE.BASIC, CONST.POLICY.APPROVAL_MODE.ADVANCED].some((approvalMode) => approvalMode === policy?.approvalMode) && !hasApprovalError) ?? false,
                pendingAction: policy?.pendingFields?.approvalMode,
                errors: ErrorUtils.getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.APPROVAL_MODE),
                onCloseError: () => Policy.clearPolicyErrorField(route.params.policyID, CONST.POLICY.COLLECTION_KEYS.APPROVAL_MODE),
            },
            {
                title: translate('workflowsPage.makeOrTrackPaymentsTitle'),
                subtitle: translate('workflowsPage.makeOrTrackPaymentsDescription'),
                switchAccessibilityLabel: translate('workflowsPage.makeOrTrackPaymentsDescription'),
                onToggle: (isEnabled: boolean) => {
                    let newReimbursementChoice;
                    if (!isEnabled) {
                        newReimbursementChoice = CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO;
                    } else if (hasVBA && !Policy.isCurrencySupportedForDirectReimbursement(policy?.outputCurrency ?? '')) {
                        newReimbursementChoice = CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_MANUAL;
                    } else {
                        newReimbursementChoice = hasVBA ? CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES : CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_MANUAL;
                    }

                    const newReimburserEmail = policy?.achAccount?.reimburser ?? policy?.owner;
                    Policy.setWorkspaceReimbursement(route.params.policyID, newReimbursementChoice, newReimburserEmail ?? '');
                },
                subMenuItems: (
                    <>
                        <MenuItem
                            titleStyle={hasVBA ? styles.textLabelSupportingNormal : styles.textLabelSupportingEmptyValue}
                            descriptionTextStyle={styles.textNormalThemeText}
                            title={
                                hasVBA && policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES
                                    ? translate('common.bankAccount')
                                    : translate('workflowsPage.connectBankAccount')
                            }
                            description={bankDisplayName}
                            disabled={isOffline || !isPolicyAdmin}
                            onPress={() => {
                                if (!Policy.isCurrencySupportedForDirectReimbursement(policy?.outputCurrency ?? '')) {
                                    setIsCurrencyModalOpen(true);
                                    return;
                                }
                                navigateToBankAccountRoute(route.params.policyID, ROUTES.WORKSPACE_WORKFLOWS.getRoute(route.params.policyID));
                            }}
                            shouldShowRightIcon={!isOffline && isPolicyAdmin}
                            wrapperStyle={containerStyle}
                            hoverAndPressStyle={[styles.mr0, styles.br2]}
                        />
                        {hasVBA && policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES && (
                            <OfflineWithFeedback
                                pendingAction={policy?.pendingFields?.reimburser}
                                errors={ErrorUtils.getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.REIMBURSER)}
                                onClose={() => Policy.clearPolicyErrorField(policy?.id ?? '', CONST.POLICY.COLLECTION_KEYS.REIMBURSER)}
                                errorRowStyles={[styles.ml7]}
                            >
                                <MenuItem
                                    titleStyle={styles.textLabelSupportingNormal}
                                    descriptionTextStyle={styles.textNormalThemeText}
                                    title={translate('workflowsPayerPage.title')}
                                    description={displayNameForAuthorizedPayer}
                                    onPress={() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_PAYER.getRoute(route.params.policyID))}
                                    shouldShowRightIcon
                                    wrapperStyle={containerStyle}
                                    hoverAndPressStyle={[styles.mr0, styles.br2]}
                                    brickRoadIndicator={hasReimburserError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                                />
                            </OfflineWithFeedback>
                        )}
                    </>
                ),
                isEndOptionRow: true,
                isActive: policy?.reimbursementChoice !== CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO,
                pendingAction: policy?.pendingFields?.reimbursementChoice,
                errors: ErrorUtils.getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.REIMBURSEMENT_CHOICE),
                onCloseError: () => Policy.clearPolicyErrorField(route.params.policyID, CONST.POLICY.COLLECTION_KEYS.REIMBURSEMENT_CHOICE),
            },
        ];
    }, [
        policy,
        styles,
        translate,
        preferredLocale,
        onPressAutoReportingFrequency,
        approvalWorkflows,
        theme.spinner,
        addApprovalAction,
        isOffline,
        isPolicyAdmin,
    ]);

    const renderOptionItem = (item: ToggleSettingOptionRowProps, index: number) => (
        <Section
            containerStyles={isSmallScreenWidth ? styles.p5 : styles.p8}
            key={`toggleSettingOptionItem-${index}`}
            renderTitle={() => <View />}
        >
            <ToggleSettingOptionRow
                title={item.title}
                titleStyle={[styles.textHeadline, styles.cardSectionTitle, styles.accountSettingsSectionTitle, styles.mb1]}
                subtitle={item.subtitle}
                subtitleStyle={[styles.textLabelSupportingEmptyValue]}
                switchAccessibilityLabel={item.switchAccessibilityLabel}
                onToggle={item.onToggle}
                subMenuItems={item.subMenuItems}
                isActive={item.isActive}
                pendingAction={item.pendingAction}
                errors={item.errors}
                onCloseError={item.onCloseError}
            />
        </Section>
    );

    const isPaidGroupPolicy = PolicyUtils.isPaidGroupPolicy(policy);
    const isLoading = !!(policy?.isLoading && policy?.reimbursementChoice === undefined);

    return (
        <AccessOrNotFoundWrapper
            policyID={route.params.policyID}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED}
        >
            <WorkspacePageWithSections
                headerText={translate('workspace.common.workflows')}
                icon={Illustrations.Workflows}
                route={route}
                guidesCallTaskID={CONST.GUIDES_CALL_TASK_IDS.WORKSPACE_WORKFLOWS}
                shouldShowOfflineIndicatorInWideScreen
                shouldShowNotFoundPage={!isPaidGroupPolicy || !isPolicyAdmin}
                isLoading={isLoading}
                shouldShowLoading={isLoading}
                shouldUseScrollView
            >
                <View style={[styles.mt3, shouldUseNarrowLayout ? styles.workspaceSectionMobile : styles.workspaceSection]}>
                    {optionItems.map(renderOptionItem)}
                    <ConfirmModal
                        title={translate('workspace.bankAccount.workspaceCurrency')}
                        isVisible={isCurrencyModalOpen}
                        onConfirm={confirmCurrencyChangeAndHideModal}
                        onCancel={() => setIsCurrencyModalOpen(false)}
                        prompt={translate('workspace.bankAccount.updateCurrencyPrompt')}
                        confirmText={translate('workspace.bankAccount.updateToUSD')}
                        cancelText={translate('common.cancel')}
                        danger
                    />
                </View>
            </WorkspacePageWithSections>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceWorkflowsPage.displayName = 'WorkspaceWorkflowsPage';

export default withPolicy(WorkspaceWorkflowsPage);
