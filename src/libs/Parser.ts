// eslint-disable-next-line no-restricted-imports
import {ExpensiMark} from 'expensify-common';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from './Log';
import * as ReportConnection from './ReportConnection';

const accountIDToNameMap: Record<string, string> = {};

Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (personalDetailsList) => {
        Object.values(personalDetailsList ?? {}).forEach((personalDetails) => {
            if (!personalDetails) {
                return;
            }

            accountIDToNameMap[personalDetails.accountID] = personalDetails.login ?? personalDetails.displayName ?? '';
        });
    },
});

type Extras = {
    reportIDToName?: Record<string, string>;
    accountIDToName?: Record<string, string>;
    cacheVideoAttributes?: (vidSource: string, attrs: string) => void;
    videoAttributeCache?: Record<string, string>;
};

class ExpensiMarkWithContext extends ExpensiMark {
    htmlToMarkdown(htmlString: string, extras?: Extras): string {
        return super.htmlToMarkdown(htmlString, {
            reportIDToName: extras?.reportIDToName ?? ReportConnection.getAllReportsNameMap(),
            accountIDToName: extras?.accountIDToName ?? accountIDToNameMap,
            cacheVideoAttributes: extras?.cacheVideoAttributes,
        });
    }

    htmlToText(htmlString: string, extras?: Extras): string {
        // Remove all HTML tags, decode HTML entities, and leave only plain text
        const strippedHtml = htmlString
            .replace(/&lt;[^&]*&gt;/g, '')   // Remove encoded HTML tags
            .replace(/<[^>]*>/g, '')        // Remove regular HTML tags
            .replace(/&amp;/g, '&')         // Decode HTML entities
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s*--\s*/g, ' ')      // Replace " -- " with a single space
            .trim();
        
        return super.htmlToText(strippedHtml, {
            reportIDToName: extras?.reportIDToName ?? ReportConnection.getAllReportsNameMap(),
            accountIDToName: extras?.accountIDToName ?? accountIDToNameMap,
            cacheVideoAttributes: extras?.cacheVideoAttributes,
        });
    }

    truncateHTML(htmlString: string, limit: number, extras?: {ellipsis: string | undefined}): string {
        return super.truncateHTML(htmlString, limit, extras);
    }
}

ExpensiMarkWithContext.setLogger(Log);
const Parser = new ExpensiMarkWithContext();

export default Parser;
