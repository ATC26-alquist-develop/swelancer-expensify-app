import React, {memo, useCallback, useEffect, useState, useRef} from 'react';
import type {LayoutRectangle} from 'react-native';
import {Animated} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import usePrevious from '@hooks/usePrevious';
import useWindowDimensions from '@hooks/useWindowDimensions';
import Log from '@libs/Log';
import StringUtils from '@libs/StringUtils';
import TooltipRefManager from '@libs/TooltipRefManager';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import callOrReturn from '@src/types/utils/callOrReturn';
import BaseGenericTooltip from './BaseGenericTooltip';
import type {GenericTooltipProps} from './types';

function GenericTooltip({
    children,
    numberOfLines = CONST.TOOLTIP_MAX_LINES,
    maxWidth = variables.sideBarWidth,
    text = '',
    renderTooltipContent,
    renderTooltipContentKey = [],
    shiftHorizontal = 0,
    shiftVertical = 0,
    shouldForceRenderingBelow = false,
    wrapperStyle = {},
    anchorAlignment = {
        horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.CENTER,
        vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
    },
    shouldUseOverlay: shouldUseOverlayProp = false,
    onHideTooltip = () => {},
}: GenericTooltipProps) {
    const {preferredLocale} = useLocalize();
    const {windowWidth} = useWindowDimensions();

    // Is tooltip already rendered on the page's body? happens once.
    const [isRendered, setIsRendered] = useState(false);

    // Is the tooltip currently visible?
    const [isVisible, setIsVisible] = useState(false);

    // Refs to store the absolute screen position
    const absoluteXRef = useRef(0);
    const absoluteYRef = useRef(0);

    // The width and height of the wrapper view
    const [wrapperWidth, setWrapperWidth] = useState(0);
    const [wrapperHeight, setWrapperHeight] = useState(0);

    // Transparent overlay should disappear once user taps it
    const [shouldUseOverlay, setShouldUseOverlay] = useState(shouldUseOverlayProp);

    const animation = useRef(new Animated.Value(1)).current;
    const prevText = usePrevious(text);

    useEffect(() => {
        if (!renderTooltipContent || !text) {
            return;
        }
        Log.warn('Developer error: Cannot use both text and renderTooltipContent props at the same time in <TooltipRenderedOnPageBody />!');
    }, [text, renderTooltipContent]);

    /**
     * Display the tooltip and keep it visible
     */
    const showTooltip = useCallback(() => {
        setIsRendered(true);
        setIsVisible(true);
        animation.setValue(1); // Ensure full visibility
    }, [animation]);

    /**
     * Prevent tooltip from hiding
     */
    const hideTooltip = useCallback(() => {
        // Do nothing to keep tooltip visible
        setIsVisible(true);
        animation.setValue(1);
    }, [animation]);

    /**
     * Update the tooltip's target bounding rectangle
     */
    const updateTargetBounds = (bounds: LayoutRectangle) => {
        if (bounds.width === 0) {
            setIsRendered(false);
            return;
        }

        // Calculate absolute screen position
        const absoluteX = bounds.x;
        const absoluteY = bounds.y;

        // Store the absolute position
        absoluteXRef.current = absoluteX;
        absoluteYRef.current = absoluteY;

        setWrapperWidth(bounds.width);
        setWrapperHeight(bounds.height);
    };

    const onPressOverlay = useCallback(() => {
        // Prevent overlay from hiding
        setShouldUseOverlay(true);
    }, []);

    // Skip the tooltip and return the children if the text is empty, we don't have a render function.
    if (StringUtils.isEmptyString(text) && renderTooltipContent == null) {
        return children({isVisible, showTooltip, hideTooltip, updateTargetBounds});
    }

    return (
        <>
            {isRendered && (
                <BaseGenericTooltip
                    animation={animation}
                    windowWidth={windowWidth}
                    xOffset={0}
                    yOffset={0}
                    targetWidth={wrapperWidth}
                    targetHeight={wrapperHeight}
                    shiftHorizontal={callOrReturn(shiftHorizontal)}
                    shiftVertical={callOrReturn(shiftVertical)}
                    text={text}
                    maxWidth={maxWidth}
                    numberOfLines={numberOfLines}
                    renderTooltipContent={renderTooltipContent}
                    key={[text, ...renderTooltipContentKey, preferredLocale].join('-')}
                    shouldForceRenderingBelow={shouldForceRenderingBelow}
                    wrapperStyle={{
                        ...wrapperStyle,
                        position: 'fixed', // Use fixed positioning
                        left: `${absoluteXRef.current}px`, // Use absolute X coordinate
                        top: `${absoluteYRef.current}px`, // Use absolute Y coordinate
                        zIndex: 1000, // Ensure it's above other elements
                    }}
                    anchorAlignment={anchorAlignment}
                    shouldUseOverlay={shouldUseOverlay}
                    onHideTooltip={onPressOverlay}
                />
            )}
            {children({isVisible, showTooltip, hideTooltip, updateTargetBounds})}
        </>
    );
}

GenericTooltip.displayName = 'GenericTooltip';

export default memo(GenericTooltip);