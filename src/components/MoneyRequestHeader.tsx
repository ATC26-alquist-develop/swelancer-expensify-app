import type {ReactNode} from 'react';
import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import variables from '@styles/variables';
import * as IOU from '@userActions/IOU';
import * as TransactionActions from '@userActions/Transaction';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Policy, Report, ReportAction, ReportActions, Session, Transaction, TransactionViolations} from '@src/types/onyx';
import type {OriginalMessageIOU} from '@src/types/onyx/OriginalMessage';
import type IconAsset from '@src/types/utils/IconAsset';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import Button from './Button';
import HeaderWithBackButton from './HeaderWithBackButton';
import Icon from './Icon';
import * as Expensicons from './Icon/Expensicons';
import type {MoneyRequestHeaderStatusBarProps} from './MoneyRequestHeaderStatusBar';
import MoneyRequestHeaderStatusBar from './MoneyRequestHeaderStatusBar';
import ProcessMoneyRequestHoldMenu from './ProcessMoneyRequestHoldMenu';

type MoneyRequestHeaderOnyxProps = {
    /** Session info for the currently logged in user. */
    session: OnyxEntry<Session>;

    /** The expense report or iou report (only will have a value if this is a transaction thread) */
    parentReport: OnyxEntry<Report>;

    /** All the data for the transaction */
    transaction: OnyxEntry<Transaction>;

    /** The violations of the transaction */
    transactionViolations: OnyxCollection<TransactionViolations>;

    /** All report actions */
    // eslint-disable-next-line react/no-unused-prop-types
    parentReportActions: OnyxEntry<ReportActions>;

    /** Whether we should show the Hold Interstitial explaining the feature */
    shownHoldUseExplanation: OnyxEntry<boolean>;
};

type MoneyRequestHeaderProps = MoneyRequestHeaderOnyxProps & {
    /** The report currently being looked at */
    report: OnyxEntry<Report>;

    /** The policy which the report is tied to */
    policy: OnyxEntry<Policy>;

    /** The report action the transaction is tied to from the parent report */
    parentReportAction: OnyxEntry<ReportAction>;

    /** Method to trigger when pressing close button of the header */
    onBackButtonPress: () => void;
};

function MoneyRequestHeader({
    session,
    parentReport,
    report,
    parentReportAction,
    transactionViolations,
    transaction,
    shownHoldUseExplanation = false,
    policy,
    shouldUseNarrowLayout = false,
    onBackButtonPress,
}: MoneyRequestHeaderProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const [shouldShowHoldMenu, setShouldShowHoldMenu] = useState(false);
    const isOnHold = TransactionUtils.isOnHold(transaction);
    const isDuplicate = TransactionUtils.isDuplicate(transaction?.transactionID ?? '');
    const reportID = report?.reportID;

    const hasAllPendingRTERViolations = TransactionUtils.allHavePendingRTERViolation([transaction?.transactionID ?? '-1']);

    const markAsCash = useCallback(() => {
        TransactionActions.markAsCash(transaction?.transactionID ?? '-1', reportID ?? '');
    }, [reportID, transaction?.transactionID]);

    const isScanning = TransactionUtils.hasReceipt(transaction) && TransactionUtils.isReceiptBeingScanned(transaction);

    const getStatusIcon: (src: IconAsset) => ReactNode = (src) => (
        <Icon
            src={src}
            height={variables.iconSizeSmall}
            width={variables.iconSizeSmall}
            fill={theme.icon}
        />
    );

    const getStatusBarProps: () => MoneyRequestHeaderStatusBarProps | undefined = () => {
        if (isOnHold) {
            return {icon: getStatusIcon(Expensicons.Stopwatch), description: isDuplicate ? translate('iou.expenseDuplicate') : translate('iou.expenseOnHold')};
        }

        if (TransactionUtils.isExpensifyCardTransaction(transaction) && TransactionUtils.isPending(transaction)) {
            return {icon: getStatusIcon(Expensicons.CreditCardHourglass), description: translate('iou.transactionPendingDescription')};
        }
        if (TransactionUtils.hasPendingRTERViolation(TransactionUtils.getTransactionViolations(transaction?.transactionID ?? '-1', transactionViolations))) {
            return {icon: getStatusIcon(Expensicons.Hourglass), description: translate('iou.pendingMatchWithCreditCardDescription')};
        }
        if (isScanning) {
            return {icon: getStatusIcon(Expensicons.ReceiptScan), description: translate('iou.receiptScanInProgressDescription')};
        }
    };

    const statusBarProps = getStatusBarProps();

    useEffect(() => {
        if (isLoadingHoldUseExplained) {
            return;
        }
        setShouldShowHoldMenu(isOnHold && !dismissedHoldUseExplanation);
    }, [dismissedHoldUseExplanation, isLoadingHoldUseExplained, isOnHold]);

    useEffect(() => {
        if (!shouldShowHoldMenu) {
            return;
        }

        if (isSmallScreenWidth) {
            if (Navigation.getActiveRoute().slice(1) === ROUTES.PROCESS_MONEY_REQUEST_HOLD.route) {
                Navigation.goBack();
            }
        } else {
            Navigation.navigate(ROUTES.PROCESS_MONEY_REQUEST_HOLD.getRoute(Navigation.getReportRHPActiveRoute()));
        }
    }, [isSmallScreenWidth, shouldShowHoldMenu]);

    const handleHoldRequestClose = () => {
        IOU.dismissHoldUseExplanation();
    };

    return (
        <>
            <View style={[styles.pl0]}>
                <HeaderWithBackButton
                    shouldShowBorderBottom={!statusBarProps && !isOnHold}
                    shouldShowReportAvatarWithDisplay
                    shouldEnableDetailPageNavigation
                    shouldShowPinButton={false}
                    report={{
                        ...report,
                        reportID: reportID ?? '',
                        ownerAccountID: parentReport?.ownerAccountID,
                    }}
                    policy={policy}
                    shouldShowBackButton={shouldUseNarrowLayout}
                    shouldDisplaySearchRouter
                    onBackButtonPress={onBackButtonPress}
                >
                    {hasAllPendingRTERViolations && !shouldUseNarrowLayout && (
                        <Button
                            success
                            text={translate('iou.markAsCash')}
                            style={[styles.p0]}
                            onPress={markAsCash}
                        />
                    )}
                    {isDuplicate && !shouldUseNarrowLayout && (
                        <Button
                            success
                            text={translate('iou.reviewDuplicates')}
                            style={[styles.p0, styles.ml2]}
                            onPress={() => {
                                Navigation.navigate(ROUTES.TRANSACTION_DUPLICATE_REVIEW_PAGE.getRoute(reportID ?? '', Navigation.getReportRHPActiveRoute()));
                            }}
                        />
                    )}
                </HeaderWithBackButton>
                {hasAllPendingRTERViolations && shouldUseNarrowLayout && (
                    <View style={[styles.ph5, styles.pb3]}>
                        <Button
                            success
                            text={translate('iou.markAsCash')}
                            style={[styles.w100, styles.pr0]}
                            onPress={markAsCash}
                        />
                    </View>
                )}
                {isDuplicate && shouldUseNarrowLayout && (
                    <View style={[styles.ph5, styles.pb3]}>
                        <Button
                            success
                            text={translate('iou.reviewDuplicates')}
                            style={[styles.w100, styles.pr0]}
                            onPress={() => {
                                Navigation.navigate(ROUTES.TRANSACTION_DUPLICATE_REVIEW_PAGE.getRoute(reportID ?? '', Navigation.getReportRHPActiveRoute()));
                            }}
                        />
                    </View>
                )}
                {statusBarProps && (
                    <View style={[styles.ph5, styles.pb3, styles.borderBottom]}>
                        <MoneyRequestHeaderStatusBar
                            icon={statusBarProps.icon}
                            description={statusBarProps.description}
                        />
                    </View>
                )}
            </View>
            {isSmallScreenWidth && shouldShowHoldMenu && (
                <ProcessMoneyRequestHoldMenu
                    onClose={handleHoldRequestClose}
                    onConfirm={handleHoldRequestClose}
                    isVisible={shouldShowHoldMenu}
                />
            )}
        </>
    );
}

MoneyRequestHeader.displayName = 'MoneyRequestHeader';

const MoneyRequestHeaderWithTransaction = withOnyx<MoneyRequestHeaderProps, Pick<MoneyRequestHeaderOnyxProps, 'transactionViolations' | 'transaction' | 'shownHoldUseExplanation'>>({
    transaction: {
        key: ({report, parentReportActions}) => {
            const parentReportAction = (report.parentReportActionID && parentReportActions ? parentReportActions[report.parentReportActionID] : {}) as ReportAction & OriginalMessageIOU;
            return `${ONYXKEYS.COLLECTION.TRANSACTION}${parentReportAction?.originalMessage?.IOUTransactionID ?? 0}`;
        },
    },
    shownHoldUseExplanation: {
        key: ONYXKEYS.NVP_HOLD_USE_EXPLAINED,
        initWithStoredValues: true,
    },
    transactionViolations: {
        key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    },
})(MoneyRequestHeader);

export default withOnyx<
    Omit<MoneyRequestHeaderProps, 'transactionViolations' | 'transaction' | 'shownHoldUseExplanation'>,
    Omit<MoneyRequestHeaderOnyxProps, 'transactionViolations' | 'transaction' | 'shownHoldUseExplanation'>
>({
    session: {
        key: ONYXKEYS.SESSION,
    },
    parentReport: {
        key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`,
    },
    parentReportActions: {
        key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID ?? '0'}`,
        canEvict: false,
    },
})(MoneyRequestHeaderWithTransaction);
