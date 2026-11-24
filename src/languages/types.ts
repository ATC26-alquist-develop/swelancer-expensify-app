/* eslint-disable @typescript-eslint/no-explicit-any */
import type en from './en';

type PluralParams = {count: number};
type PluralHandler = ((count: number) => string) | string;
type PluralForm = {
    zero?: string;
    one: string;
    two?: string;
    few?: PluralHandler;
    many?: PluralHandler;
    other: PluralHandler;
};

/**
 * Retrieves the first argument of a function
 */
type FirstArgument<TFunction> = TFunction extends (arg: infer A, ...args: any[]) => any ? A : never;

/**
 * Translation value can be a string or a function that returns a string
 */
type TranslationLeafValue<TStringOrFunction> = TStringOrFunction extends string
    ? string
    : (
          arg: FirstArgument<TStringOrFunction> extends Record<string, unknown> | undefined ? FirstArgument<TStringOrFunction> : Record<string, unknown>,
          ...noOtherArguments: unknown[]
      ) => string | PluralForm;

/**
 * Translation object is a recursive object that can contain other objects or string/function values
 */
type TranslationDeepObject<TTranslations = any> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Path in keyof TTranslations]: TTranslations[Path] extends string | ((...args: any[]) => any)
        ? TranslationLeafValue<TTranslations[Path]>
        : TTranslations[Path] extends number | boolean | null | undefined | unknown[]
        ? string
        : TranslationDeepObject<TTranslations[Path]>;
};

/**
 * Flattens an object and returns concatenations of all the keys of nested objects
 *
 * Ex:
 * Input: { common: { yes: "Yes", no: "No" }}
 * Output: "common.yes" | "common.no"
 */
type FlattenObject<TObject, TPrefix extends string = ''> = {
    [TKey in keyof TObject]: TObject[TKey] extends (arg: any) => any
        ? `${TPrefix}${TKey & string}`
        : // eslint-disable-next-line @typescript-eslint/ban-types
        TObject[TKey] extends object
        ? FlattenObject<TObject[TKey], `${TPrefix}${TKey & string}.`>
        : `${TPrefix}${TKey & string}`;
}[keyof TObject];

/**
 * Retrieves a type for a given key path (calculated from the type above)
 */
type TranslationValue<TObject, TKey extends string> = TKey extends keyof TObject
    ? TObject[TKey]
    : TKey extends `${infer TPathKey}.${infer TRest}`
    ? TPathKey extends keyof TObject
        ? TranslationValue<TObject[TPathKey], TRest>
        : never
    : never;

/**
 * English is the default translation, other languages will be type-safe based on this
 */
type DefaultTranslation = typeof en;

/**
 * Flattened default translation object
 */
type TranslationPaths = FlattenObject<DefaultTranslation>;

/**
 * Flattened default translation object with its values
 */
type FlatTranslationsObject = {
    [Path in TranslationPaths]: TranslationValue<DefaultTranslation, Path>;
};

/**
 * Determines the expected parameters for a specific translation function based on the provided translation path
 */
type TranslationParameters<TKey extends TranslationPaths> = FlatTranslationsObject[TKey] extends (...args: infer Args) => infer Return
    ? Return extends PluralForm
        ? Args[0] extends undefined
            ? [PluralParams]
            : [Args[0] & PluralParams]
        : Args
    : never[];

type ElectronicFundsParams = {percentage: string; amount: string};

type LogSizeParams = {size: number};

type HeldRequestParams = {comment: string};

type DistanceRateOperationsParams = {count: number};

type ReimbursementRateParams = {unit: Unit};

type ChangeFieldParams = {oldValue?: string; newValue: string; fieldName: string};

type ChangePolicyParams = {fromPolicy: string; toPolicy: string};

type ChangeTypeParams = {oldType: string; newType: string};

type DelegateSubmitParams = {delegateUser: string; originalManager: string};

type ExportedToIntegrationParams = {label: string};

type ForwardedParams = {amount: string; currency: string};

type IntegrationsMessageParams = {
    label: string;
    result: {
        code?: number;
        messages?: string[];
        title?: string;
        link?: {
            url: string;
            text: string;
        };
    };
};

type MarkedReimbursedParams = {amount: string; currency: string};

type MarkReimbursedFromIntegrationParams = {amount: string; currency: string};

type ShareParams = {to: string};

type UnshareParams = {to: string};

type StripePaidParams = {amount: string; currency: string};

type UnapprovedParams = {amount: string; currency: string};
type RemoveMembersWarningPrompt = {
    memberName: string;
    ownerName: string;
};

export type {
    AddressLineParams,
    AdminCanceledRequestParams,
    AlreadySignedInParams,
    ApprovedAmountParams,
    BeginningOfChatHistoryAdminRoomPartOneParams,
    BeginningOfChatHistoryAnnounceRoomPartOneParams,
    BeginningOfChatHistoryAnnounceRoomPartTwo,
    BeginningOfChatHistoryDomainRoomPartOneParams,
    CanceledRequestParams,
    CharacterLimitParams,
    ConfirmThatParams,
    DateShouldBeAfterParams,
    DateShouldBeBeforeParams,
    DeleteActionParams,
    DeleteConfirmationParams,
    DidSplitAmountMessageParams,
    DistanceRateOperationsParams,
    EditActionParams,
    ElectronicFundsParams,
    EnglishTranslation,
    EnterMagicCodeParams,
    FormattedMaxLengthParams,
    GoBackMessageParams,
    GoToRoomParams,
    HeldRequestParams,
    InstantSummaryParams,
    LocalTimeParams,
    LogSizeParams,
    LoggedInAsParams,
    ManagerApprovedAmountParams,
    ManagerApprovedParams,
    SignUpNewFaceCodeParams,
    NoLongerHaveAccessParams,
    NotAllowedExtensionParams,
    NotYouParams,
    OOOEventSummaryFullDayParams,
    OOOEventSummaryPartialDayParams,
    OurEmailProviderParams,
    PaidElsewhereWithAmountParams,
    PaidWithExpensifyWithAmountParams,
    ParentNavigationSummaryParams,
    PaySomeoneParams,
    PayerOwesAmountParams,
    PayerOwesParams,
    PayerPaidAmountParams,
    PayerPaidParams,
    PayerSettledParams,
    ReimbursementRateParams,
    RemovedTheRequestParams,
    RenamedRoomActionParams,
    ReportArchiveReasonsClosedParams,
    ReportArchiveReasonsMergedParams,
    ReportArchiveReasonsPolicyDeletedParams,
    ReportArchiveReasonsRemovedFromPolicyParams,
    RequestAmountParams,
    RequestCountParams,
    RequestedAmountMessageParams,
    ResolutionConstraintsParams,
    RoomNameReservedErrorParams,
    RoomRenamedToParams,
    SetTheDistanceParams,
    SetTheRequestParams,
    SettleExpensifyCardParams,
    SettledAfterAddedBankAccountParams,
    SizeExceededParams,
    SplitAmountParams,
    StepCounterParams,
    TaskCreatedActionParams,
    TermsParams,
    ThreadRequestReportNameParams,
    ThreadSentMoneyReportNameParams,
    ToValidateLoginParams,
    TransferParams,
    TranslationBase,
    TranslationFlatObject,
    TranslationPaths,
    UntilTimeParams,
    UpdatedTheDistanceParams,
    UpdatedTheRequestParams,
    UsePlusButtonParams,
    UserIsAlreadyMemberParams,
    UserSplitParams,
    ViolationsAutoReportedRejectedExpenseParams,
    ViolationsCashExpenseWithNoReceiptParams,
    ViolationsConversionSurchargeParams,
    ViolationsInvoiceMarkupParams,
    ViolationsMaxAgeParams,
    ViolationsMissingTagParams,
    ViolationsOverAutoApprovalLimitParams,
    ViolationsOverCategoryLimitParams,
    ViolationsOverLimitParams,
    ViolationsPerDayLimitParams,
    ViolationsReceiptRequiredParams,
    ViolationsRterParams,
    ViolationsTagOutOfPolicyParams,
    ViolationsTaxOutOfPolicyParams,
    WaitingOnBankAccountParams,
    WalletProgramParams,
    WeSentYouMagicSignInLinkParams,
    WelcomeEnterMagicCodeParams,
    WelcomeNoteParams,
    WelcomeToRoomParams,
    ZipCodeExampleFormatParams,
    ChangeFieldParams,
    ChangePolicyParams,
    ChangeTypeParams,
    ExportedToIntegrationParams,
    DelegateSubmitParams,
    ForwardedParams,
    IntegrationsMessageParams,
    MarkedReimbursedParams,
    MarkReimbursedFromIntegrationParams,
    ShareParams,
    UnshareParams,
    StripePaidParams,
    UnapprovedParams,
    RemoveMembersWarningPrompt,
};
