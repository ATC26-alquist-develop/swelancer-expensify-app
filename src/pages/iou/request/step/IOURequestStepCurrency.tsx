import {Str} from 'expensify-common';
import React, {useMemo, useState} from 'react';
import {Keyboard} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import type {ListItem} from '@components/SelectionList/types';
import useLocalize from '@hooks/useLocalize';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportUtils from '@libs/ReportUtils';
import {appendParam} from '@libs/Url';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {CurrencyList, Transaction} from '@src/types/onyx';
import StepScreenWrapper from './StepScreenWrapper';
import withFullTransactionOrNotFound from './withFullTransactionOrNotFound';
import type {WithFullTransactionOrNotFoundProps} from './withFullTransactionOrNotFound';

type IOURequestStepCurrencyOnyxProps = {
    /** Constant, list of available currencies */
    currencyList: OnyxEntry<CurrencyList>;

    /** The draft transaction object being modified in Onyx */
    draftTransaction: OnyxEntry<Transaction>;
    /** List of recently used currencies */
    recentlyUsedCurrencies: OnyxEntry<string[]>;
};

type IOURequestStepCurrencyProps = IOURequestStepCurrencyOnyxProps & WithFullTransactionOrNotFoundProps<typeof SCREENS.MONEY_REQUEST.STEP_CURRENCY>;

type CurrencyListItem = ListItem & {
    currencyName: string;
    currencyCode: string;
};

function IOURequestStepCurrency({
    currencyList,
    route: {
        params: {backTo, pageIndex, transactionID, action, currency: selectedCurrency = ''},
    },
    draftTransaction,
    recentlyUsedCurrencies,
}: IOURequestStepCurrencyProps) {
    const {translate} = useLocalize();
    const [searchValue, setSearchValue] = useState('');
    const {currency: originalCurrency = ''} = ReportUtils.getTransactionDetails(draftTransaction) ?? {};
    const currency = CurrencyUtils.isValidCurrencyCode(selectedCurrency) ? selectedCurrency : originalCurrency;

    const navigateBack = (selectedCurrencyValue = '') => {
        // If the currency selection was done from the confirmation step (eg. + > submit expense > manual > confirm > amount > currency)
        // then the user needs taken back to the confirmation page instead of the initial amount page. This is because the route params
        // are only able to handle one backTo param at a time and the user needs to go back to the amount page before going back
        // to the confirmation page
        if (pageIndex === CONST.IOU.PAGE_INDEX.CONFIRM) {
            if (selectedCurrencyValue) {
                Navigation.navigate(appendParam(backTo as string, 'currency', selectedCurrencyValue));
            } else {
                Navigation.goBack(backTo);
            }
            return;
        }
        Navigation.goBack(backTo);
    };

    const confirmCurrencySelection = (option: CurrencyListItem) => {
        Keyboard.dismiss();
        if (pageIndex !== CONST.IOU.PAGE_INDEX.CONFIRM) {
            IOU.setMoneyRequestCurrency(transactionID, option.currencyCode, action === CONST.IOU.ACTION.EDIT);
        }

        Navigation.setNavigationActionToMicrotaskQueue(() => navigateBack(option.currencyCode));
    };

    const {sections, headerMessage, initiallyFocusedOptionKey} = useMemo(() => {
        const currencyOptions: CurrencyListItem[] = Object.entries(currencyList ?? {}).map(([currencyCode, currencyInfo]) => {
            const isSelectedCurrency = currencyCode === currency.toUpperCase();
            return {
                currencyName: currencyInfo?.name ?? '',
                text: `${currencyCode} - ${CurrencyUtils.getLocalizedCurrencySymbol(currencyCode)}`,
                currencyCode,
                keyForList: currencyCode,
                isSelected: isSelectedCurrency,
            };
        });

        const searchRegex = new RegExp(Str.escapeForRegExp(searchValue.trim()), 'i');
        const filteredCurrencies = currencyOptions.filter((currencyOption) => searchRegex.test(currencyOption.text ?? '') || searchRegex.test(currencyOption.currencyName));
        const isEmpty = searchValue.trim() && !filteredCurrencies.length;

        return {
            initiallyFocusedOptionKey: filteredCurrencies.find((filteredCurrency) => filteredCurrency.currencyCode === currency.toUpperCase())?.keyForList,
            sections: isEmpty
                ? []
                : [
                      {
                          data: filteredCurrencies,
                      },
                  ],
            headerMessage: isEmpty ? translate('common.noResultsFound') : '',
        };
    }, [currencyList, searchValue, currency, translate]);

    return (
        <StepScreenWrapper
            headerTitle={translate('common.selectCurrency')}
            onBackButtonPress={() => navigateBack()}
            shouldShowWrapper
            testID={IOURequestStepCurrency.displayName}
            includeSafeAreaPaddingBottom={false}
        >
            {({didScreenTransitionEnd}) => (
                <SelectionList
                    sections={sections}
                    ListItem={RadioListItem}
                    textInputLabel={translate('common.search')}
                    textInputValue={searchValue}
                    onChangeText={setSearchValue}
                    onSelectRow={(option) => {
                        if (!didScreenTransitionEnd) {
                            return;
                        }
                        confirmCurrencySelection(option);
                    }}
                    headerMessage={headerMessage}
                    initiallyFocusedOptionKey={initiallyFocusedOptionKey}
                    showScrollIndicator
                />
            )}
        </StepScreenWrapper>
    );
}

IOURequestStepCurrency.displayName = 'IOURequestStepCurrency';

const IOURequestStepCurrencyWithOnyx = withOnyx<IOURequestStepCurrencyProps, IOURequestStepCurrencyOnyxProps>({
    currencyList: {key: ONYXKEYS.CURRENCY_LIST},
    draftTransaction: {
        key: ({route}) => {
            const transactionID = route?.params?.transactionID ?? -1;
            return `${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transactionID}`;
        },
    },
    recentlyUsedCurrencies: {
        key: ONYXKEYS.RECENTLY_USED_CURRENCIES,
    },
})(IOURequestStepCurrency);

/* eslint-disable rulesdir/no-negated-variables */
const IOURequestStepCurrencyWithFullTransactionOrNotFound = withFullTransactionOrNotFound(IOURequestStepCurrencyWithOnyx);

export default IOURequestStepCurrencyWithFullTransactionOrNotFound;
