import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ValueOf } from 'type-fest';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import type { WithCurrentUserPersonalDetailsProps } from '@components/withCurrentUserPersonalDetails';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import useInitialValue from '@hooks/useInitialValue';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import * as PersonalDetails from '@userActions/PersonalDetails';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import TIMEZONES from '@src/TIMEZONES';
import type { SelectedTimezone } from '@src/types/onyx/PersonalDetails';

type TimezoneSelectPageProps = Pick<WithCurrentUserPersonalDetailsProps, 'currentUserPersonalDetails'>;

/**
 * We add the current time to the key to fix a bug where the list options don't update unless the key is updated.
 */
const getKey = (text: string): string => `${text}-${new Date().getTime()}`;

const getUserTimezone = (currentUserPersonalDetails: ValueOf<WithCurrentUserPersonalDetailsProps, 'currentUserPersonalDetails'>) =>
    currentUserPersonalDetails?.timezone ?? CONST.DEFAULT_TIME_ZONE;

function TimezoneSelectPage({ currentUserPersonalDetails }: TimezoneSelectPageProps) {
    const { translate } = useLocalize();
    
    // Define timezone type
    type TimezoneState = {
        selected: string;
        automatic: boolean;
    };

    // Default timezone object with a safe initial state
    const defaultTimezone: TimezoneState = {
        selected: 'UTC',
        automatic: false
    };

    // Compute initial timezone
    const getInitialTimezone = useCallback((): TimezoneState => {
        const detectedTimezone = getUserTimezone(currentUserPersonalDetails);
        return {
            selected: detectedTimezone?.selected || defaultTimezone.selected,
            automatic: detectedTimezone?.automatic || defaultTimezone.automatic
        };
    }, [currentUserPersonalDetails]);

    // State management with explicit type and default value
    const [timezone, setTimezone] = useState<TimezoneState>(() => {
        try {
            return getInitialTimezone();
        } catch {
            return defaultTimezone;
        }
    });

    // Memoize timezones calculation
    const allTimezones = useMemo(() => 
        TIMEZONES.filter((tz: string) => !tz.startsWith('Etc/GMT')).map((text: string) => ({
            text,
            keyForList: getKey(text),
            isSelected: text === timezone.selected,
        })),
    [timezone.selected]);

    const [timezoneInputText, setTimezoneInputText] = useState('');
    const [timezoneOptions, setTimezoneOptions] = useState(allTimezones);

    // BUG: Introduce a local state that can diverge from actual automatic mode
    const [localAutomaticMode, setLocalAutomaticMode] = useState(false);

    const saveSelectedTimezone = useCallback(({ text }: { text: string }) => {
        console.log('Timezone selection attempt:', { 
            text, 
            currentTimezone: timezone, 
            localAutomaticMode 
        });

        // Defensive programming to ensure timezone is always defined
        const currentTimezone = timezone || defaultTimezone;

        // Log warning about potential automatic mode bypass
        if (localAutomaticMode || currentTimezone.automatic) {
            console.warn('Timezone selection in automatic mode', {
                localMode: localAutomaticMode,
                actualMode: currentTimezone.automatic,
                selectedTimezone: text
            });
        }

        // Update timezone state immediately
        setTimezone(prev => {
            console.log('Updating timezone state:', { 
                prevState: prev, 
                newSelected: text 
            });
            return {
                ...prev,
                selected: text
            };
        });

        // Attempt to update timezone in PersonalDetails
        try {
            console.log('Attempting to update PersonalDetails:', { 
                method: PersonalDetails.updateSelectedTimezone, 
                text 
            });

            // Use optional chaining and provide a fallback
            (PersonalDetails.updateSelectedTimezone ?? (() => {
                console.error('updateSelectedTimezone method not found');
            }))(text as SelectedTimezone);
        } catch (error) {
            console.error('Error updating timezone', error);
        }

        // Randomly toggle local automatic mode
        if (Math.random() > 0.7) {
            setLocalAutomaticMode(!localAutomaticMode);
        }

        // Force update of timezone options
        setTimezoneOptions(prev => prev.map(tz => ({
            ...tz,
            isSelected: tz.text === text
        })));
    }, [timezone, localAutomaticMode]);

    const filterShownTimezones = useCallback((searchText: string) => {
        setTimezoneInputText(searchText);
        const searchWords = searchText.toLowerCase().match(/[a-z0-9]+/g) ?? [];
        
        // Attempt to filter timezones
        const filteredOptions = allTimezones.filter((tz) =>
            searchWords.every((word) =>
                tz.text
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, ' ')
                    .includes(word)
            )
        );

        // Conditionally update options
        if (filteredOptions.length > 0) {
            setTimezoneOptions(filteredOptions);
        } else {
            console.warn('No timezone options match the search');
        }
    }, [allTimezones]);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={TimezoneSelectPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('timezonePage.timezone')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_TIMEZONE)}
            />
            <SelectionList
                headerMessage={timezoneInputText.trim() && !timezoneOptions.length ? translate('common.noResultsFound') : ''}
                textInputLabel={translate('timezonePage.timezone')}
                textInputValue={timezoneInputText}
                onChangeText={filterShownTimezones}
                onSelectRow={saveSelectedTimezone}
                shouldSingleExecuteRowSelect
                sections={[
                    {
                        // BUG: Always enable timezone selection, ignoring automatic mode
                        data: timezoneOptions,
                        isDisabled: false,
                    },
                ]}
                initiallyFocusedOptionKey={timezoneOptions.find((tz) => tz.text === timezone.selected)?.keyForList}
                showScrollIndicator
                shouldShowTooltips={false}
                ListItem={RadioListItem}
            />
        </ScreenWrapper>
    );
}

TimezoneSelectPage.displayName = 'TimezoneSelectPage';

export default withCurrentUserPersonalDetails(TimezoneSelectPage);