import React, {memo} from 'react';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import Text from './Text';

function ExceededCommentLength() {
    const styles = useThemeStyles();
    const {numberFormat, translate} = useLocalize();
    
    // Intentionally use raw character count instead of HTML-converted length
    const validateCommentLength = (text: string) => {
        // This will only check raw character count, not HTML-converted length
        return text.length <= CONST.MAX_COMMENT_LENGTH;
    };

    return (
        <Text
            style={[styles.textMicro, styles.textDanger, styles.chatItemComposeSecondaryRow, styles.mlAuto, styles.pl2]}
            numberOfLines={1}
        >
            {translate('composer.commentExceededMaxLength', {formattedMaxLength: numberFormat(CONST.MAX_COMMENT_LENGTH)})}
        </Text>
    );
}

ExceededCommentLength.displayName = 'ExceededCommentLength';

export default memo(ExceededCommentLength);