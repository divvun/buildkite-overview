import type { TypedDocumentNode } from "npm:@graphql-typed-document-node/core"
import { gql } from "npm:graphql-tag"

const VariableName = " $1fcbcbff-3e78-462f-b45c-668a3e09bfd8"

const ScalarBrandingField = " $1fcbcbff-3e78-462f-b45c-668a3e09bfd9"

type CustomScalar<T> = { [ScalarBrandingField]: T }

class Variable<T, Name extends string, IsRequired extends boolean | undefined = undefined> {
  private [VariableName]: Name
  public readonly isRequired?: IsRequired
  declare private _typeMarker: T

  constructor(name: Name, isRequired?: IsRequired) {
    this[VariableName] = name
    this.isRequired = isRequired as IsRequired
  }
}

type ArrayInput<I> = [I] extends [$Atomic] ? never : ReadonlyArray<VariabledInput<I>>

type AllowedInlineScalars<S> = S extends string | number ? S : never

export type UnwrapCustomScalars<T> = T extends CustomScalar<infer S> ? S
  : T extends ReadonlyArray<infer I> ? ReadonlyArray<UnwrapCustomScalars<I>>
  : T extends Record<string, any> ? { [K in keyof T]: UnwrapCustomScalars<T[K]> }
  : T

type VariableWithoutScalars<T, Str extends string> = Variable<UnwrapCustomScalars<T>, Str, any>

// the array wrapper prevents distributive conditional types
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
type VariabledInput<T> = [T] extends [CustomScalar<infer S> | null | undefined]
  // scalars only support variable input
  ? Variable<S | null | undefined, any, any> | AllowedInlineScalars<S> | null | undefined
  : [T] extends [CustomScalar<infer S>] ? Variable<S, any, any> | AllowedInlineScalars<S>
  : [T] extends [$Atomic] ? Variable<T, any, any> | T
  : T extends ReadonlyArray<infer I> ? VariableWithoutScalars<T, any> | T | ArrayInput<I>
  : T extends Record<string, any> | null | undefined ?
      | VariableWithoutScalars<T | null | undefined, any>
      | null
      | undefined
      | { [K in keyof T]: VariabledInput<T[K]> }
      | T
  : T extends Record<string, any> ? VariableWithoutScalars<T, any> | { [K in keyof T]: VariabledInput<T[K]> } | T
  : never

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I
  : never

/**
 * Creates a new query variable
 *
 * @param name The variable name
 */
export const $ = <Type, Name extends string>(name: Name): Variable<Type, Name, undefined> => {
  return new Variable(name, undefined)
}

/**
 * Creates a new query variable. A value will be required even if the input is optional
 *
 * @param name The variable name
 */
export const $$ = <Type, Name extends string>(name: Name): Variable<NonNullable<Type>, Name, true> => {
  return new Variable(name, true)
}

type SelectOptions = {
  argTypes?: { [key: string]: string }
  args?: { [key: string]: any }
  selection?: Selection<any>
}

class $Field<Name extends string, Type, Vars = {}> {
  public kind: "field" = "field"
  public type!: Type

  public vars!: Vars
  public alias: string | null = null

  constructor(public name: Name, public options: SelectOptions) {}

  as<Rename extends string>(alias: Rename): $Field<Rename, Type, Vars> {
    const f = new $Field(this.name, this.options)
    f.alias = alias
    return f as any
  }
}

class $Base<Name extends string> {
  constructor(protected $$name: Name) {}

  protected $_select<Key extends string>(
    name: Key,
    options: SelectOptions = {},
  ): $Field<Key, any, any> {
    return new $Field(name, options)
  }
}

class $Union<T, Name extends string> extends $Base<Name> {
  protected $$type!: T

  constructor(private selectorClasses: { [K in keyof T]: { new (): T[K] } }, $$name: Name) {
    super($$name)
  }

  $on<Type extends keyof T, Sel extends Selection<T[Type]>>(
    alternative: Type,
    selectorFn: (selector: T[Type]) => [...Sel],
  ): $UnionSelection<GetOutput<Sel>, GetVariables<Sel>> {
    const selection = selectorFn(new this.selectorClasses[alternative]())

    return new $UnionSelection(alternative as string, selection)
  }
}

class $Interface<T, Name extends string> extends $Base<Name> {
  protected $$type!: T

  constructor(private selectorClasses: { [K in keyof T]: { new (): T[K] } }, $$name: Name) {
    super($$name)
  }
  $on<Type extends keyof T, Sel extends Selection<T[Type]>>(
    alternative: Type,
    selectorFn: (selector: T[Type]) => [...Sel],
  ): $UnionSelection<GetOutput<Sel>, GetVariables<Sel>> {
    const selection = selectorFn(new this.selectorClasses[alternative]())

    return new $UnionSelection(alternative as string, selection)
  }
}

class $UnionSelection<T, Vars> {
  public kind: "union" = "union"
  protected vars!: Vars
  constructor(public alternativeName: string, public alternativeSelection: Selection<T>) {}
}

export type Selection<_any> = Array<$Field<any, any, any> | $UnionSelection<any, any>>

type NeverNever<T> = [T] extends [never] ? {} : T

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type LeafType<T> = T extends CustomScalar<infer S> ? S : T

export type GetOutput<X extends Selection<any>> = Simplify<
  & UnionToIntersection<
    {
      [I in keyof X]: X[I] extends $Field<infer Name, infer Type, any> ? { [K in Name]: LeafType<Type> }
        : never
    }[keyof X & number]
  >
  & NeverNever<
    {
      [I in keyof X]: X[I] extends $UnionSelection<infer Type, any> ? LeafType<Type> : never
    }[keyof X & number]
  >
>

type PossiblyOptionalVar<VName extends string, VType> = null extends VType ? { [key in VName]?: VType }
  : { [key in VName]: VType }

type ExtractInputVariables<Inputs> = Inputs extends Variable<infer VType, infer VName, any>
  ? PossiblyOptionalVar<VName, VType>
  // Avoid generating an index signature for possibly undefined or null inputs.
  // The compiler incorrectly infers null or undefined, and we must force access the Inputs
  // type to convince the compiler its "never", while still retaining {} as the result
  // for null and undefined cases
  // Works around issue 79
  : Inputs extends null | undefined ? { [K in keyof Inputs]: Inputs[K] }
  : Inputs extends $Atomic ? {}
  : Inputs extends any[] | readonly any[] ? UnionToIntersection<
      { [K in keyof Inputs]: ExtractInputVariables<Inputs[K]> }[keyof Inputs & number]
    >
  : UnionToIntersection<{ [K in keyof Inputs]: ExtractInputVariables<Inputs[K]> }[keyof Inputs]>

export type GetVariables<Sel extends Selection<any>, ExtraVars = {}> =
  & UnionToIntersection<
    {
      [I in keyof Sel]: Sel[I] extends $Field<any, any, infer Vars> ? Vars
        : Sel[I] extends $UnionSelection<any, infer Vars> ? Vars
        : never
    }[keyof Sel & number]
  >
  & ExtractInputVariables<ExtraVars>

type ArgVarType = {
  type: string
  isRequired: boolean
  array: {
    isRequired: boolean
  } | null
}

const arrRegex = /\[(.*?)\]/

/**
 * Converts graphql string type to `ArgVarType`
 * @param input
 * @returns
 */
function getArgVarType(input: string): ArgVarType {
  const array = input.includes("[")
    ? {
      isRequired: input.endsWith("!"),
    }
    : null

  const type = array ? arrRegex.exec(input)![1]! : input
  const isRequired = type.endsWith("!")

  return {
    array,
    isRequired: isRequired,
    type: type.replace("!", ""),
  }
}

function fieldToQuery(prefix: string, field: $Field<any, any, any>) {
  const variables = new Map<string, { variable: Variable<any, any, any>; type: ArgVarType }>()

  function stringifyArgs(
    args: any,
    argTypes: { [key: string]: string },
    argVarType?: ArgVarType,
  ): string {
    switch (typeof args) {
      case "string": {
        const cleanType = argVarType!.type
        if ($Enums.has(cleanType!)) return args
        else return JSON.stringify(args)
      }
      case "number":
      case "boolean":
        return JSON.stringify(args)
      default: {
        if (args == null) return "null"
        if (VariableName in (args as any)) {
          if (!argVarType) {
            throw new globalThis.Error("Cannot use variabe as sole unnamed field argument")
          }
          const variable = args as Variable<any, any, any>
          const argVarName = variable[VariableName]
          variables.set(argVarName, { type: argVarType, variable: variable })
          return "$" + argVarName
        }
        if (Array.isArray(args)) {
          return "[" + args.map((arg) => stringifyArgs(arg, argTypes, argVarType)).join(",") + "]"
        }
        const wrapped = (content: string) => (argVarType ? "{" + content + "}" : content)
        return wrapped(
          Array.from(Object.entries(args))
            .map(([key, val]) => {
              let argTypeForKey = argTypes[key]
              if (!argTypeForKey) {
                throw new globalThis.Error(`Argument type for ${key} not found`)
              }
              const cleanType = argTypeForKey.replace("[", "").replace("]", "").replace(/!/g, "")
              return (
                key +
                ":" +
                stringifyArgs(val, $InputTypes[cleanType]!, getArgVarType(argTypeForKey))
              )
            })
            .join(","),
        )
      }
    }
  }

  function extractTextAndVars(field: $Field<any, any, any> | $UnionSelection<any, any>) {
    if (field.kind === "field") {
      let retVal = field.name
      if (field.alias) retVal = field.alias + ":" + retVal
      const args = field.options.args,
        argTypes = field.options.argTypes
      if (args && Object.keys(args).length > 0) {
        retVal += "(" + stringifyArgs(args, argTypes!) + ")"
      }
      let sel = field.options.selection
      if (sel) {
        retVal += "{"
        for (let subField of sel) {
          retVal += extractTextAndVars(subField)
        }
        retVal += "}"
      }
      return retVal + " "
    } else if (field.kind === "union") {
      let retVal = "... on " + field.alternativeName + " {"
      for (let subField of field.alternativeSelection) {
        retVal += extractTextAndVars(subField)
      }
      retVal += "}"

      return retVal + " "
    } else {
      throw new globalThis.Error("Uknown field kind")
    }
  }

  const queryRaw = extractTextAndVars(field)!

  const queryBody = queryRaw.substring(queryRaw.indexOf("{"))

  const varList = Array.from(variables.entries())
  let ret = prefix
  if (varList.length) {
    ret += "(" +
      varList
        .map(([name, { type: kind, variable }]) => {
          let type = kind.array ? "[" : ""
          type += kind.type
          if (kind.isRequired) type += "!"
          if (kind.array) type += kind.array.isRequired ? "]!" : "]"

          if (!type.endsWith("!") && variable.isRequired === true) {
            type += "!"
          }

          return "$" + name + ":" + type
        })
        .join(",") +
      ")"
  }
  ret += queryBody

  return ret
}

export type OutputTypeOf<T> = T extends $Interface<infer Subtypes, any>
  ? { [K in keyof Subtypes]: OutputTypeOf<Subtypes[K]> }[keyof Subtypes]
  : T extends $Union<infer Subtypes, any> ? { [K in keyof Subtypes]: OutputTypeOf<Subtypes[K]> }[keyof Subtypes]
  : T extends $Base<any> ? { [K in keyof T]?: OutputTypeOf<T[K]> }
  : [T] extends [$Field<any, infer FieldType, any>] ? FieldType
  : [T] extends [(selFn: (arg: infer Inner) => any) => any] ? OutputTypeOf<Inner>
  : [T] extends [(args: any, selFn: (arg: infer Inner) => any) => any] ? OutputTypeOf<Inner>
  : never

export type QueryOutputType<T extends TypedDocumentNode<any>> = T extends TypedDocumentNode<
  infer Out
> ? Out
  : never

export type QueryInputType<T extends TypedDocumentNode<any>> = T extends TypedDocumentNode<
  any,
  infer In
> ? In
  : never

export function fragment<T, Sel extends Selection<T>>(
  GQLType: { new (): T },
  selectFn: (selector: T) => [...Sel],
) {
  return selectFn(new GQLType())
}

type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R
  : never

// TS4.0+
type Push<T extends any[], V> = [...T, V]

// TS4.1+
type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N ? []
  : Push<TuplifyUnion<Exclude<T, L>>, L>

type AllFieldProperties<I> = {
  [K in keyof I]: I[K] extends $Field<infer Name, infer Type, any> ? $Field<Name, Type, any> : never
}

type ValueOf<T> = T[keyof T]

export type AllFields<T> = TuplifyUnion<ValueOf<AllFieldProperties<T>>>

export function all<I extends $Base<any>>(instance: I) {
  const prototype = Object.getPrototypeOf(instance)
  const allFields = Object.getOwnPropertyNames(prototype)
    .map((k) => prototype[k])
    .filter((o) => o?.kind === "field")
    .map((o) => o?.name) as (keyof typeof instance)[]
  return allFields.map((fieldName) => instance?.[fieldName]) as any as AllFields<I>
}

type $Atomic =
  | APIAccessTokenScopes
  | AnnotationOrder
  | AnnotationStyle
  | AuditActorType
  | AuditEventType
  | AuditSubjectType
  | AuthorizationType
  | BuildBlockedStates
  | BuildStates
  | ClusterOrder
  | ClusterQueueOrder
  | HostedAgentArchitecture
  | HostedAgentInstanceShapeName
  | HostedAgentMacOSVersion
  | HostedAgentMachineType
  | HostedAgentSize
  | JobEventActorType
  | JobEventSignalReason
  | JobEventType
  | JobOrder
  | JobRetryTypes
  | JobStates
  | JobTypes
  | NoticeNamespaces
  | OrganizationAuditEventOrders
  | OrganizationInvitationOrders
  | OrganizationInvitationStates
  | OrganizationMemberOrder
  | OrganizationMemberRole
  | OrganizationMemberSSOModeEnum
  | PipelineAccessLevels
  | PipelineOrders
  | PipelineTemplateOrder
  | PipelineVisibility
  | RegistryAccessLevels
  | RegistryOrders
  | RevokeInactiveTokenPeriod
  | RuleAction
  | RuleEffect
  | RuleOrder
  | RuleSourceType
  | RuleTargetType
  | SSOAuthorizationState
  | SSOProviderSAMLRSAXMLSecurity
  | SSOProviderSAMLXMLSecurity
  | SSOProviderStates
  | SSOProviderTypes
  | SuiteAccessLevels
  | SuiteOrders
  | TeamMemberOrder
  | TeamMemberRole
  | TeamOrder
  | TeamPipelineOrder
  | TeamPrivacy
  | TeamRegistryOrder
  | TeamSuiteOrder
  | number
  | string
  | boolean
  | null
  | undefined

let $Enums = new Set<string>([
  "APIAccessTokenScopes",
  "AnnotationOrder",
  "AnnotationStyle",
  "AuditActorType",
  "AuditEventType",
  "AuditSubjectType",
  "AuthorizationType",
  "BuildBlockedStates",
  "BuildStates",
  "ClusterOrder",
  "ClusterQueueOrder",
  "HostedAgentArchitecture",
  "HostedAgentInstanceShapeName",
  "HostedAgentMacOSVersion",
  "HostedAgentMachineType",
  "HostedAgentSize",
  "JobEventActorType",
  "JobEventSignalReason",
  "JobEventType",
  "JobOrder",
  "JobRetryTypes",
  "JobStates",
  "JobTypes",
  "NoticeNamespaces",
  "OrganizationAuditEventOrders",
  "OrganizationInvitationOrders",
  "OrganizationInvitationStates",
  "OrganizationMemberOrder",
  "OrganizationMemberRole",
  "OrganizationMemberSSOModeEnum",
  "PipelineAccessLevels",
  "PipelineOrders",
  "PipelineTemplateOrder",
  "PipelineVisibility",
  "RegistryAccessLevels",
  "RegistryOrders",
  "RevokeInactiveTokenPeriod",
  "RuleAction",
  "RuleEffect",
  "RuleOrder",
  "RuleSourceType",
  "RuleTargetType",
  "SSOAuthorizationState",
  "SSOProviderSAMLRSAXMLSecurity",
  "SSOProviderSAMLXMLSecurity",
  "SSOProviderStates",
  "SSOProviderTypes",
  "SuiteAccessLevels",
  "SuiteOrders",
  "TeamMemberOrder",
  "TeamMemberRole",
  "TeamOrder",
  "TeamPipelineOrder",
  "TeamPrivacy",
  "TeamRegistryOrder",
  "TeamSuiteOrder",
])

/**
 * API access tokens for authentication with the Buildkite API
 */
export class APIAccessToken extends $Base<"APIAccessToken"> {
  constructor() {
    super("APIAccessToken")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The public UUID for the API Access Token
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A code that is used by an API Application to request an API Access Token
 */
export class APIAccessTokenCode extends $Base<"APIAccessTokenCode"> {
  constructor() {
    super("APIAccessTokenCode")
  }

  application<Sel extends Selection<APIApplication>>(
    selectorFn: (s: APIApplication) => [...Sel],
  ): $Field<"application", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new APIApplication()),
    }
    return this.$_select("application", options as any) as any
  }

  /**
   * The time when this code was authorized by a user
   */
  get authorizedAt(): $Field<"authorizedAt", CustomScalar<DateTime> | null> {
    return this.$_select("authorizedAt") as any
  }

  /**
   * The IP address of the client that authorized this code
   */
  get authorizedIPAddress(): $Field<"authorizedIPAddress", string | null> {
    return this.$_select("authorizedIPAddress") as any
  }

  /**
   * The actual code used to find this API Access Token Code record
   */
  get code(): $Field<"code", string> {
    return this.$_select("code") as any
  }

  /**
   * The description of the code provided by the API Application
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  /**
   * The time when this code will expire
   */
  get expiresAt(): $Field<"expiresAt", CustomScalar<DateTime>> {
    return this.$_select("expiresAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * Autogenerated input type of APIAccessTokenCodeAuthorizeMutation
 */
export type APIAccessTokenCodeAuthorizeMutationInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of APIAccessTokenCodeAuthorizeMutation.
 */
export class APIAccessTokenCodeAuthorizeMutationPayload extends $Base<"APIAccessTokenCodeAuthorizeMutationPayload"> {
  constructor() {
    super("APIAccessTokenCodeAuthorizeMutationPayload")
  }

  apiAccessTokenCode<Sel extends Selection<APIAccessTokenCode>>(
    selectorFn: (s: APIAccessTokenCode) => [...Sel],
  ): $Field<"apiAccessTokenCode", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new APIAccessTokenCode()),
    }
    return this.$_select("apiAccessTokenCode", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * All possible scopes on a user's API Access Token
 */
export enum APIAccessTokenScopes {
  DELETE_PACKAGES = "DELETE_PACKAGES",

  DELETE_REGISTRIES = "DELETE_REGISTRIES",

  GRAPHQL = "GRAPHQL",

  READ_AGENTS = "READ_AGENTS",

  READ_ARTIFACTS = "READ_ARTIFACTS",

  READ_BUILD_LOGS = "READ_BUILD_LOGS",

  READ_BUILDS = "READ_BUILDS",

  READ_CLUSTERS = "READ_CLUSTERS",

  READ_JOB_ENV = "READ_JOB_ENV",

  READ_ORGANIZATIONS = "READ_ORGANIZATIONS",

  READ_PACKAGES = "READ_PACKAGES",

  READ_PIPELINE_TEMPLATES = "READ_PIPELINE_TEMPLATES",

  READ_PIPELINES = "READ_PIPELINES",

  READ_PORTALS = "READ_PORTALS",

  READ_REGISTRIES = "READ_REGISTRIES",

  READ_RULES = "READ_RULES",

  READ_SECRETS_DETAILS = "READ_SECRETS_DETAILS",

  READ_SUITES = "READ_SUITES",

  READ_TEAMS = "READ_TEAMS",

  READ_TEST_PLAN = "READ_TEST_PLAN",

  READ_USER = "READ_USER",

  WRITE_AGENTS = "WRITE_AGENTS",

  WRITE_ARTIFACTS = "WRITE_ARTIFACTS",

  WRITE_BUILD_LOGS = "WRITE_BUILD_LOGS",

  WRITE_BUILDS = "WRITE_BUILDS",

  WRITE_CLUSTERS = "WRITE_CLUSTERS",

  WRITE_PACKAGES = "WRITE_PACKAGES",

  WRITE_PIPELINE_TEMPLATES = "WRITE_PIPELINE_TEMPLATES",

  WRITE_PIPELINES = "WRITE_PIPELINES",

  WRITE_PORTALS = "WRITE_PORTALS",

  WRITE_REGISTRIES = "WRITE_REGISTRIES",

  WRITE_RULES = "WRITE_RULES",

  WRITE_SECRETS = "WRITE_SECRETS",

  WRITE_SUITES = "WRITE_SUITES",

  WRITE_TEAMS = "WRITE_TEAMS",

  WRITE_TEST_PLAN = "WRITE_TEST_PLAN",
}

/**
 * An API Application
 */
export class APIApplication extends $Base<"APIApplication"> {
  constructor() {
    super("APIApplication")
  }

  /**
   * A description of the application
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of this application
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * An agent
 */
export class Agent extends $Base<"Agent"> {
  constructor() {
    super("Agent")
  }

  clusterQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"clusterQueue", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("clusterQueue", options as any) as any
  }

  /**
   * The time when the agent connected to Buildkite
   */
  get connectedAt(): $Field<"connectedAt", CustomScalar<DateTime> | null> {
    return this.$_select("connectedAt") as any
  }

  /**
   * The connection state of the agent
   */
  get connectionState(): $Field<"connectionState", string> {
    return this.$_select("connectionState") as any
  }

  /**
   * The date the agent was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The time when the agent disconnected from Buildkite
   */
  get disconnectedAt(): $Field<"disconnectedAt", CustomScalar<DateTime> | null> {
    return this.$_select("disconnectedAt") as any
  }

  /**
   * The last time the agent performed a `heartbeat` operation to the Agent API
   */
  get heartbeatAt(): $Field<"heartbeatAt", CustomScalar<DateTime> | null> {
    return this.$_select("heartbeatAt") as any
  }

  /**
   * The hostname of the machine running the agent
   */
  get hostname(): $Field<"hostname", string | null> {
    return this.$_select("hostname") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The IP address that the agent has connected from
   */
  get ipAddress(): $Field<"ipAddress", string | null> {
    return this.$_select("ipAddress") as any
  }

  /**
   * If this version of agent has been deprecated by Buildkite
   */
  get isDeprecated(): $Field<"isDeprecated", boolean> {
    return this.$_select("isDeprecated") as any
  }

  /**
   * Returns whether or not this agent is running a job. If isRunningJob true, but the `job` field is empty, the current user doesn't have access to view the job
   */
  get isRunningJob(): $Field<"isRunningJob", boolean> {
    return this.$_select("isRunningJob") as any
  }

  /**
   * The currently running job
   */
  job<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"job", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * Jobs that have been assigned to this agent
   */
  jobs<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: number | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    Sel extends Selection<JobConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: number | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  jobs<Sel extends Selection<JobConnection>>(
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel>>
  jobs(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        type: "[JobTypes!]",
        state: "[JobStates!]",
        priority: "Int",
        agentQueryRules: "[String!]",
        concurrency: "JobConcurrencySearch",
        passed: "Boolean",
        step: "JobStepSearch",
        order: "JobOrder",
      },
      args,

      selection: selectorFn(new JobConnection()),
    }
    return this.$_select("jobs", options as any) as any
  }

  /**
   * The date the agent was lost from Buildkite if it didn't cleanly disconnect
   */
  get lostAt(): $Field<"lostAt", CustomScalar<DateTime> | null> {
    return this.$_select("lostAt") as any
  }

  /**
   * The meta data this agent was stared with
   */
  get metaData(): $Field<"metaData", Readonly<Array<string>> | null> {
    return this.$_select("metaData") as any
  }

  /**
   * The name of the agent
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The operating system the agent is running on
   */
  operatingSystem<Sel extends Selection<OperatingSystem>>(
    selectorFn: (s: OperatingSystem) => [...Sel],
  ): $Field<"operatingSystem", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OperatingSystem()),
    }
    return this.$_select("operatingSystem", options as any) as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Whether this agent is paused, preventing dispatch of new jobs
   */
  get paused(): $Field<"paused", boolean> {
    return this.$_select("paused") as any
  }

  /**
   * Whether this agent is paused, preventing dispatch of new jobs
   */
  get pausedAt(): $Field<"pausedAt", CustomScalar<DateTime> | null> {
    return this.$_select("pausedAt") as any
  }

  /**
   * The user who paused this agent, if paused
   */
  pausedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"pausedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("pausedBy", options as any) as any
  }

  /**
   * Note supplied when agent was paused, if paused
   */
  get pausedNote(): $Field<"pausedNote", string | null> {
    return this.$_select("pausedNote") as any
  }

  /**
   * Number of minutes the agent will remain paused for, if paused
   */
  get pausedTimeoutInMinutes(): $Field<"pausedTimeoutInMinutes", number> {
    return this.$_select("pausedTimeoutInMinutes") as any
  }

  permissions<Sel extends Selection<AgentPermissions>>(
    selectorFn: (s: AgentPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The process identifier (PID) of the agent process on the machine
   */
  get pid(): $Field<"pid", string | null> {
    return this.$_select("pid") as any
  }

  get pingedAt(): $Field<"pingedAt", CustomScalar<DateTime> | null> {
    return this.$_select("pingedAt") as any
  }

  /**
   * The priority setting for the agent
   */
  get priority(): $Field<"priority", number | null> {
    return this.$_select("priority") as any
  }

  /**
   * Whether this agent is visible to everyone, including people outside this organization
   */
  get public(): $Field<"public", boolean> {
    return this.$_select("public") as any
  }

  /**
   * The time this agent was forced to stop
   */
  get stopForcedAt(): $Field<"stopForcedAt", CustomScalar<DateTime> | null> {
    return this.$_select("stopForcedAt") as any
  }

  /**
   * The user that forced this agent to stop
   */
  stopForcedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"stopForcedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("stopForcedBy", options as any) as any
  }

  /**
   * The time the agent was first asked to stop
   */
  get stoppedAt(): $Field<"stoppedAt", CustomScalar<DateTime> | null> {
    return this.$_select("stoppedAt") as any
  }

  /**
   * The user that initially stopped this agent
   */
  stoppedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"stoppedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("stoppedBy", options as any) as any
  }

  /**
   * The time the agent was gracefully stopped by a user
   */
  get stoppedGracefullyAt(): $Field<"stoppedGracefullyAt", CustomScalar<DateTime> | null> {
    return this.$_select("stoppedGracefullyAt") as any
  }

  /**
   * The user that gracefully stopped this agent
   */
  stoppedGracefullyBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"stoppedGracefullyBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("stoppedGracefullyBy", options as any) as any
  }

  /**
   * The User-Agent of the program that is making Agent API requests to Buildkite
   */
  get userAgent(): $Field<"userAgent", string | null> {
    return this.$_select("userAgent") as any
  }

  /**
   * The public UUID for the agent
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }

  /**
   * The version of the agent
   */
  get version(): $Field<"version", string | null> {
    return this.$_select("version") as any
  }

  /**
   * Whether this agent's version has known issues and should be upgraded
   */
  get versionHasKnownIssues(): $Field<"versionHasKnownIssues", boolean> {
    return this.$_select("versionHasKnownIssues") as any
  }
}

export class AgentConnection extends $Base<"AgentConnection"> {
  constructor() {
    super("AgentConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<AgentEdge>>(
    selectorFn: (s: AgentEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class AgentEdge extends $Base<"AgentEdge"> {
  constructor() {
    super("AgentEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of AgentPause
 */
export type AgentPauseInput = {
  clientMutationId?: string | null
  id: string
  note?: string | null
  timeoutInMinutes?: number | null
}

/**
 * Autogenerated return type of AgentPause.
 */
export class AgentPausePayload extends $Base<"AgentPausePayload"> {
  constructor() {
    super("AgentPausePayload")
  }

  agent<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"agent", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("agent", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * Permissions information about what actions the current user can do against this agent
 */
export class AgentPermissions extends $Base<"AgentPermissions"> {
  constructor() {
    super("AgentPermissions")
  }

  /**
   * Whether the user can pause job dispatch to the agent
   */
  agentPause<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentPause", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentPause", options as any) as any
  }

  /**
   * Whether the user can resume job dispatch to the agent
   */
  agentResume<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentResume", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentResume", options as any) as any
  }

  /**
   * Whether the user can stop the agent remotely
   */
  agentStop<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentStop", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentStop", options as any) as any
  }
}

/**
 * Autogenerated input type of AgentResume
 */
export type AgentResumeInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of AgentResume.
 */
export class AgentResumePayload extends $Base<"AgentResumePayload"> {
  constructor() {
    super("AgentResumePayload")
  }

  agent<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"agent", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("agent", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * Autogenerated input type of AgentStop
 */
export type AgentStopInput = {
  clientMutationId?: string | null
  graceful?: boolean | null
  id: string
}

/**
 * Autogenerated return type of AgentStop.
 */
export class AgentStopPayload extends $Base<"AgentStopPayload"> {
  constructor() {
    super("AgentStopPayload")
  }

  agent<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"agent", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("agent", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * A token used to connect an agent to Buildkite
 */
export class AgentToken extends $Base<"AgentToken"> {
  constructor() {
    super("AgentToken")
  }

  /**
   * The time this agent token was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this agent token
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * A description about what this agent token is used for
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  permissions<Sel extends Selection<AgentTokenPermissions>>(
    selectorFn: (s: AgentTokenPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentTokenPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * Whether agents registered with this token will be visible to everyone, including people outside this organization
   */
  get public(): $Field<"public", boolean> {
    return this.$_select("public") as any
  }

  /**
   * The time this agent token was revoked
   */
  get revokedAt(): $Field<"revokedAt", CustomScalar<DateTime> | null> {
    return this.$_select("revokedAt") as any
  }

  /**
   * The user that revoked this agent token
   */
  revokedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"revokedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("revokedBy", options as any) as any
  }

  /**
   * The reason as defined by the user why this token was revoked
   */
  get revokedReason(): $Field<"revokedReason", string | null> {
    return this.$_select("revokedReason") as any
  }

  /**
   * The token value used to register a new agent
   */
  get token(): $Field<"token", string> {
    return this.$_select("token") as any
  }

  /**
   * The public UUID for the agent
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class AgentTokenConnection extends $Base<"AgentTokenConnection"> {
  constructor() {
    super("AgentTokenConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<AgentTokenEdge>>(
    selectorFn: (s: AgentTokenEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentTokenEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of AgentTokenCreate
 */
export type AgentTokenCreateInput = {
  clientMutationId?: string | null
  description?: string | null
  organizationID: string
  public?: boolean | null
}

/**
 * Autogenerated return type of AgentTokenCreate.
 */
export class AgentTokenCreatePayload extends $Base<"AgentTokenCreatePayload"> {
  constructor() {
    super("AgentTokenCreatePayload")
  }

  agentTokenEdge<Sel extends Selection<AgentTokenEdge>>(
    selectorFn: (s: AgentTokenEdge) => [...Sel],
  ): $Field<"agentTokenEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentTokenEdge()),
    }
    return this.$_select("agentTokenEdge", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * The token value used to register a new unclustered agent. Please ensure to securely copy this value immediately upon generation as it will not be displayed again.
   */
  get tokenValue(): $Field<"tokenValue", string> {
    return this.$_select("tokenValue") as any
  }
}

export class AgentTokenEdge extends $Base<"AgentTokenEdge"> {
  constructor() {
    super("AgentTokenEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<AgentToken>>(
    selectorFn: (s: AgentToken) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentToken()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Permissions information about what actions the current user can do against the agent token
 */
export class AgentTokenPermissions extends $Base<"AgentTokenPermissions"> {
  constructor() {
    super("AgentTokenPermissions")
  }

  /**
   * Whether the user can revoke this agent token
   */
  agentTokenRevoke<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentTokenRevoke", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentTokenRevoke", options as any) as any
  }
}

/**
 * Autogenerated input type of AgentTokenRevoke
 */
export type AgentTokenRevokeInput = {
  clientMutationId?: string | null
  id: string
  reason: string
}

/**
 * Autogenerated return type of AgentTokenRevoke.
 */
export class AgentTokenRevokePayload extends $Base<"AgentTokenRevokePayload"> {
  constructor() {
    super("AgentTokenRevokePayload")
  }

  agentToken<Sel extends Selection<AgentToken>>(
    selectorFn: (s: AgentToken) => [...Sel],
  ): $Field<"agentToken", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AgentToken()),
    }
    return this.$_select("agentToken", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * An annotation allows you to add arbitrary content to the top of a build page in the Buildkite UI
 */
export class Annotation extends $Base<"Annotation"> {
  constructor() {
    super("Annotation")
  }

  /**
   * The body of the annotation
   */
  body<Sel extends Selection<AnnotationBody>>(
    selectorFn: (s: AnnotationBody) => [...Sel],
  ): $Field<"body", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AnnotationBody()),
    }
    return this.$_select("body", options as any) as any
  }

  /**
   * The context of the annotation that helps you differentiate this one from others
   */
  get context(): $Field<"context", string> {
    return this.$_select("context") as any
  }

  /**
   * The date the annotation was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The priority of the annotation
   */
  get priority(): $Field<"priority", number> {
    return this.$_select("priority") as any
  }

  /**
   * The visual style of the annotation
   */
  get style(): $Field<"style", AnnotationStyle | null> {
    return this.$_select("style") as any
  }

  /**
   * The last time the annotation was changed
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The public UUID for this annotation
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A body of an annotation
 */
export class AnnotationBody extends $Base<"AnnotationBody"> {
  constructor() {
    super("AnnotationBody")
  }

  /**
   * The body of the annotation rendered as HTML. The renderer result could be an empty string if the textual version has unsupported HTML tags
   */
  get html(): $Field<"html", string | null> {
    return this.$_select("html") as any
  }

  /**
   * The body of the annotation as text
   */
  get text(): $Field<"text", string> {
    return this.$_select("text") as any
  }
}

export class AnnotationConnection extends $Base<"AnnotationConnection"> {
  constructor() {
    super("AnnotationConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<AnnotationEdge>>(
    selectorFn: (s: AnnotationEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AnnotationEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class AnnotationEdge extends $Base<"AnnotationEdge"> {
  constructor() {
    super("AnnotationEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Annotation>>(
    selectorFn: (s: Annotation) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Annotation()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort annotations by
 */
export enum AnnotationOrder {
  /**
   * Order by priority, then by the most recently created annotations first
   */
  PRIORITY_RECENTLY_CREATED = "PRIORITY_RECENTLY_CREATED",

  /**
   * Order by the most recently created annotations first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * The visual style of the annotation
 */
export enum AnnotationStyle {
  /**
   * The default styling of an annotation
   */
  DEFAULT = "DEFAULT",

  /**
   * The annotation has a green border with a tick next to it
   */
  SUCCESS = "SUCCESS",

  /**
   * The annotation has a blue border with an information icon next to it
   */
  INFO = "INFO",

  /**
   * The annotation has an orange border with a warning icon next to it
   */
  WARNING = "WARNING",

  /**
   *  The annotation has a red border with a cross next to it
   */
  ERROR = "ERROR",
}

/**
 * A file uploaded from the agent whilst running a job
 */
export class Artifact extends $Base<"Artifact"> {
  constructor() {
    super("Artifact")
  }

  /**
   * The download URL for the artifact. Unless you've used your own artifact storage, the URL will be valid for only 10 minutes.
   */
  get downloadURL(): $Field<"downloadURL", string> {
    return this.$_select("downloadURL") as any
  }

  /**
   * The time when the artifact will, or did, expire
   */
  get expiresAt(): $Field<"expiresAt", CustomScalar<DateTime> | null> {
    return this.$_select("expiresAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that uploaded this artifact
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The mime type of the file provided by the agent
   */
  get mimeType(): $Field<"mimeType", string> {
    return this.$_select("mimeType") as any
  }

  /**
   * The path of the uploaded artifact
   */
  get path(): $Field<"path", string> {
    return this.$_select("path") as any
  }

  /**
   * A SHA1SUM of the file
   */
  get sha1sum(): $Field<"sha1sum", string> {
    return this.$_select("sha1sum") as any
  }

  /**
   * A SHA256SUM of the file
   */
  get sha256sum(): $Field<"sha256sum", string | null> {
    return this.$_select("sha256sum") as any
  }

  /**
   * The size of the file in bytes that was uploaded
   */
  get size(): $Field<"size", number> {
    return this.$_select("size") as any
  }

  /**
   * The upload state of the artifact
   */
  get state(): $Field<"state", string> {
    return this.$_select("state") as any
  }

  /**
   * The public UUID for this artifact
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class ArtifactConnection extends $Base<"ArtifactConnection"> {
  constructor() {
    super("ArtifactConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<ArtifactEdge>>(
    selectorFn: (s: ArtifactEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ArtifactEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class ArtifactEdge extends $Base<"ArtifactEdge"> {
  constructor() {
    super("ArtifactEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Artifact>>(
    selectorFn: (s: Artifact) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Artifact()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Context for an audit event created during an REST/GraphQL API request
 */
export class AuditAPIContext extends $Base<"AuditAPIContext"> {
  constructor() {
    super("AuditAPIContext")
  }

  /**
   * The API access token UUID used to authenticate the request
   */
  get requestApiAccessTokenUuid(): $Field<"requestApiAccessTokenUuid", string | null> {
    return this.$_select("requestApiAccessTokenUuid") as any
  }

  /**
   * The remote IP which made the request
   */
  get requestIpAddress(): $Field<"requestIpAddress", string | null> {
    return this.$_select("requestIpAddress") as any
  }

  /**
   * The client supplied user agent which made the request
   */
  get requestUserAgent(): $Field<"requestUserAgent", string | null> {
    return this.$_select("requestUserAgent") as any
  }
}

/**
 * The actor who caused an AuditEvent
 */
export class AuditActor extends $Base<"AuditActor"> {
  constructor() {
    super("AuditActor")
  }

  /**
   * The GraphQL ID for this actor
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name or short description of this actor
   */
  get name(): $Field<"name", string | null> {
    return this.$_select("name") as any
  }

  /**
   * The node corresponding to this actor, if available
   */
  node<Sel extends Selection<AuditActorNode>>(
    selectorFn: (s: AuditActorNode) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditActorNode()),
    }
    return this.$_select("node", options as any) as any
  }

  /**
   * The type of this actor
   */
  get type(): $Field<"type", AuditActorType | null> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID of this actor
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Kinds of actors which can perform audit events
 */
export class AuditActorNode extends $Union<{ Agent: Agent; User: User; Node: Node }, "AuditActorNode"> {
  constructor() {
    super({ Agent: Agent, User: User, Node: Node }, "AuditActorNode")
  }
}

/**
 * All the possible types of actors in an Audit Event
 */
export enum AuditActorType {
  AGENT = "AGENT",

  USER = "USER",
}

/**
 * Context for an audit event created during an agent API request
 */
export class AuditAgentAPIContext extends $Base<"AuditAgentAPIContext"> {
  constructor() {
    super("AuditAgentAPIContext")
  }

  /**
   * The agent UUID
   */
  get agentUuid(): $Field<"agentUuid", string | null> {
    return this.$_select("agentUuid") as any
  }

  /**
   * The type of token that authenticated the agent
   */
  get authenticationType(): $Field<"authenticationType", string | null> {
    return this.$_select("authenticationType") as any
  }

  /**
   * The connection state of the agent
   */
  get connectionState(): $Field<"connectionState", string | null> {
    return this.$_select("connectionState") as any
  }

  /**
   * The organization UUID that the agent belongs to
   */
  get organizationUuid(): $Field<"organizationUuid", string | null> {
    return this.$_select("organizationUuid") as any
  }

  /**
   * The remote IP which made the request
   */
  get requestIpAddress(): $Field<"requestIpAddress", string | null> {
    return this.$_select("requestIpAddress") as any
  }

  /**
   * The IP of the agent session which made the request
   */
  get sessionIpAddress(): $Field<"sessionIpAddress", string | null> {
    return this.$_select("sessionIpAddress") as any
  }
}

/**
 * Kinds of contexts in which an audit event can be performed
 */
export class AuditContext extends $Union<
  { AuditAPIContext: AuditAPIContext; AuditAgentAPIContext: AuditAgentAPIContext; AuditWebContext: AuditWebContext },
  "AuditContext"
> {
  constructor() {
    super({
      AuditAPIContext: AuditAPIContext,
      AuditAgentAPIContext: AuditAgentAPIContext,
      AuditWebContext: AuditWebContext,
    }, "AuditContext")
  }
}

/**
 * Audit record of an event which occurred in the system
 */
export class AuditEvent extends $Base<"AuditEvent"> {
  constructor() {
    super("AuditEvent")
  }

  /**
   * The actor who caused this event
   */
  actor<Sel extends Selection<AuditActor>>(
    selectorFn: (s: AuditActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  /**
   * The context in which this event occurred
   */
  context<Sel extends Selection<AuditContext>>(
    selectorFn: (s: AuditContext) => [...Sel],
  ): $Field<"context", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditContext()),
    }
    return this.$_select("context", options as any) as any
  }

  /**
   * The changed data in the event
   */
  get data(): $Field<"data", CustomScalar<JSON> | null> {
    return this.$_select("data") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The time at which this event occurred
   */
  get occurredAt(): $Field<"occurredAt", CustomScalar<DateTime>> {
    return this.$_select("occurredAt") as any
  }

  /**
   * The subject of this event
   */
  subject<Sel extends Selection<AuditSubject>>(
    selectorFn: (s: AuditSubject) => [...Sel],
  ): $Field<"subject", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditSubject()),
    }
    return this.$_select("subject", options as any) as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", AuditEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for the event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * All the possible types of an Audit Event
 */
export enum AuditEventType {
  API_ACCESS_TOKEN_CREATED = "API_ACCESS_TOKEN_CREATED",

  API_ACCESS_TOKEN_DELETED = "API_ACCESS_TOKEN_DELETED",

  API_ACCESS_TOKEN_ORGANIZATION_ACCESS_REVOKED = "API_ACCESS_TOKEN_ORGANIZATION_ACCESS_REVOKED",

  API_ACCESS_TOKEN_UPDATED = "API_ACCESS_TOKEN_UPDATED",

  AGENT_TOKEN_CREATED = "AGENT_TOKEN_CREATED",

  AGENT_TOKEN_REVOKED = "AGENT_TOKEN_REVOKED",

  AGENT_TOKEN_UPDATED = "AGENT_TOKEN_UPDATED",

  AUTHORIZATION_CREATED = "AUTHORIZATION_CREATED",

  AUTHORIZATION_DELETED = "AUTHORIZATION_DELETED",

  CACHE_REGISTRY_CREATED = "CACHE_REGISTRY_CREATED",

  CACHE_REGISTRY_DELETED = "CACHE_REGISTRY_DELETED",

  CACHE_REGISTRY_UPDATED = "CACHE_REGISTRY_UPDATED",

  CLUSTER_CREATED = "CLUSTER_CREATED",

  CLUSTER_DELETED = "CLUSTER_DELETED",

  CLUSTER_PERMISSION_CREATED = "CLUSTER_PERMISSION_CREATED",

  CLUSTER_PERMISSION_DELETED = "CLUSTER_PERMISSION_DELETED",

  CLUSTER_QUEUE_CREATED = "CLUSTER_QUEUE_CREATED",

  CLUSTER_QUEUE_DELETED = "CLUSTER_QUEUE_DELETED",

  CLUSTER_QUEUE_TOKEN_CREATED = "CLUSTER_QUEUE_TOKEN_CREATED",

  CLUSTER_QUEUE_TOKEN_DELETED = "CLUSTER_QUEUE_TOKEN_DELETED",

  CLUSTER_QUEUE_TOKEN_UPDATED = "CLUSTER_QUEUE_TOKEN_UPDATED",

  CLUSTER_QUEUE_UPDATED = "CLUSTER_QUEUE_UPDATED",

  CLUSTER_TOKEN_CREATED = "CLUSTER_TOKEN_CREATED",

  CLUSTER_TOKEN_DELETED = "CLUSTER_TOKEN_DELETED",

  CLUSTER_TOKEN_UPDATED = "CLUSTER_TOKEN_UPDATED",

  CLUSTER_UPDATED = "CLUSTER_UPDATED",

  COMPOSITE_REGISTRY_UPSTREAM_ADDED = "COMPOSITE_REGISTRY_UPSTREAM_ADDED",

  COMPOSITE_REGISTRY_UPSTREAM_REMOVED = "COMPOSITE_REGISTRY_UPSTREAM_REMOVED",

  JOB_TERMINAL_SESSION_STARTED = "JOB_TERMINAL_SESSION_STARTED",

  NOTIFICATION_SERVICE_BROKEN = "NOTIFICATION_SERVICE_BROKEN",

  NOTIFICATION_SERVICE_CREATED = "NOTIFICATION_SERVICE_CREATED",

  NOTIFICATION_SERVICE_DELETED = "NOTIFICATION_SERVICE_DELETED",

  NOTIFICATION_SERVICE_DISABLED = "NOTIFICATION_SERVICE_DISABLED",

  NOTIFICATION_SERVICE_ENABLED = "NOTIFICATION_SERVICE_ENABLED",

  NOTIFICATION_SERVICE_UPDATED = "NOTIFICATION_SERVICE_UPDATED",

  ORGANIZATION_BANNER_CREATED = "ORGANIZATION_BANNER_CREATED",

  ORGANIZATION_BANNER_DELETED = "ORGANIZATION_BANNER_DELETED",

  ORGANIZATION_BANNER_UPDATED = "ORGANIZATION_BANNER_UPDATED",

  ORGANIZATION_BILLING_SETTING_UPDATED = "ORGANIZATION_BILLING_SETTING_UPDATED",

  ORGANIZATION_BUILD_EXPORT_UPDATED = "ORGANIZATION_BUILD_EXPORT_UPDATED",

  ORGANIZATION_CREATED = "ORGANIZATION_CREATED",

  ORGANIZATION_DELETED = "ORGANIZATION_DELETED",

  ORGANIZATION_IMPERSONATION_REQUEST_APPROVED = "ORGANIZATION_IMPERSONATION_REQUEST_APPROVED",

  ORGANIZATION_IMPERSONATION_REQUEST_REVOKED = "ORGANIZATION_IMPERSONATION_REQUEST_REVOKED",

  ORGANIZATION_INVITATION_ACCEPTED = "ORGANIZATION_INVITATION_ACCEPTED",

  ORGANIZATION_INVITATION_CREATED = "ORGANIZATION_INVITATION_CREATED",

  ORGANIZATION_INVITATION_RESENT = "ORGANIZATION_INVITATION_RESENT",

  ORGANIZATION_INVITATION_REVOKED = "ORGANIZATION_INVITATION_REVOKED",

  ORGANIZATION_MEMBER_CREATED = "ORGANIZATION_MEMBER_CREATED",

  ORGANIZATION_MEMBER_DELETED = "ORGANIZATION_MEMBER_DELETED",

  ORGANIZATION_MEMBER_UPDATED = "ORGANIZATION_MEMBER_UPDATED",

  ORGANIZATION_TEAMS_DISABLED = "ORGANIZATION_TEAMS_DISABLED",

  ORGANIZATION_TEAMS_ENABLED = "ORGANIZATION_TEAMS_ENABLED",

  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",

  PIPELINE_CREATED = "PIPELINE_CREATED",

  PIPELINE_DELETED = "PIPELINE_DELETED",

  PIPELINE_SCHEDULE_CREATED = "PIPELINE_SCHEDULE_CREATED",

  PIPELINE_SCHEDULE_DELETED = "PIPELINE_SCHEDULE_DELETED",

  PIPELINE_SCHEDULE_UPDATED = "PIPELINE_SCHEDULE_UPDATED",

  PIPELINE_TEMPLATE_CREATED = "PIPELINE_TEMPLATE_CREATED",

  PIPELINE_TEMPLATE_DELETED = "PIPELINE_TEMPLATE_DELETED",

  PIPELINE_TEMPLATE_UPDATED = "PIPELINE_TEMPLATE_UPDATED",

  PIPELINE_UPDATED = "PIPELINE_UPDATED",

  PIPELINE_VISIBILITY_CHANGED = "PIPELINE_VISIBILITY_CHANGED",

  PIPELINE_WEBHOOK_URL_ROTATED = "PIPELINE_WEBHOOK_URL_ROTATED",

  PORTAL_CREATED = "PORTAL_CREATED",

  PORTAL_DELETED = "PORTAL_DELETED",

  PORTAL_SECRET_CREATED = "PORTAL_SECRET_CREATED",

  PORTAL_SECRET_DELETED = "PORTAL_SECRET_DELETED",

  PORTAL_TOKEN_CODE_AUTHORIZED = "PORTAL_TOKEN_CODE_AUTHORIZED",

  PORTAL_TOKEN_CREATED = "PORTAL_TOKEN_CREATED",

  PORTAL_TOKEN_DELETED = "PORTAL_TOKEN_DELETED",

  PORTAL_UPDATED = "PORTAL_UPDATED",

  REGISTRY_CREATED = "REGISTRY_CREATED",

  REGISTRY_DELETED = "REGISTRY_DELETED",

  REGISTRY_TOKEN_CREATED = "REGISTRY_TOKEN_CREATED",

  REGISTRY_TOKEN_DELETED = "REGISTRY_TOKEN_DELETED",

  REGISTRY_TOKEN_UPDATED = "REGISTRY_TOKEN_UPDATED",

  REGISTRY_UPDATED = "REGISTRY_UPDATED",

  REGISTRY_VISIBILITY_CHANGED = "REGISTRY_VISIBILITY_CHANGED",

  RULE_CREATED = "RULE_CREATED",

  RULE_DELETED = "RULE_DELETED",

  RULE_UPDATED = "RULE_UPDATED",

  SCM_PIPELINE_SETTINGS_CREATED = "SCM_PIPELINE_SETTINGS_CREATED",

  SCM_PIPELINE_SETTINGS_DELETED = "SCM_PIPELINE_SETTINGS_DELETED",

  SCM_PIPELINE_SETTINGS_UPDATED = "SCM_PIPELINE_SETTINGS_UPDATED",

  SCM_REPOSITORY_HOST_CREATED = "SCM_REPOSITORY_HOST_CREATED",

  SCM_REPOSITORY_HOST_DESTROYED = "SCM_REPOSITORY_HOST_DESTROYED",

  SCM_REPOSITORY_HOST_UPDATED = "SCM_REPOSITORY_HOST_UPDATED",

  SCM_SERVICE_CREATED = "SCM_SERVICE_CREATED",

  SCM_SERVICE_DELETED = "SCM_SERVICE_DELETED",

  SCM_SERVICE_UPDATED = "SCM_SERVICE_UPDATED",

  SSO_PROVIDER_CREATED = "SSO_PROVIDER_CREATED",

  SSO_PROVIDER_DELETED = "SSO_PROVIDER_DELETED",

  SSO_PROVIDER_DISABLED = "SSO_PROVIDER_DISABLED",

  SSO_PROVIDER_ENABLED = "SSO_PROVIDER_ENABLED",

  SSO_PROVIDER_UPDATED = "SSO_PROVIDER_UPDATED",

  SECRET_CREATED = "SECRET_CREATED",

  SECRET_DELETED = "SECRET_DELETED",

  SECRET_QUERIED = "SECRET_QUERIED",

  SECRET_READ = "SECRET_READ",

  SECRET_UPDATED = "SECRET_UPDATED",

  SECRET_VALUE_UPDATED = "SECRET_VALUE_UPDATED",

  STORAGE_CREATED = "STORAGE_CREATED",

  SUBSCRIPTION_ACTIVATED = "SUBSCRIPTION_ACTIVATED",

  SUBSCRIPTION_CANCELED = "SUBSCRIPTION_CANCELED",

  SUBSCRIPTION_PLAN_ADDED = "SUBSCRIPTION_PLAN_ADDED",

  SUBSCRIPTION_PLAN_CANCELATION_SCHEDULED = "SUBSCRIPTION_PLAN_CANCELATION_SCHEDULED",

  SUBSCRIPTION_PLAN_CANCELED = "SUBSCRIPTION_PLAN_CANCELED",

  SUBSCRIPTION_PLAN_CHANGE_SCHEDULED = "SUBSCRIPTION_PLAN_CHANGE_SCHEDULED",

  SUBSCRIPTION_PLAN_CHANGED = "SUBSCRIPTION_PLAN_CHANGED",

  SUBSCRIPTION_SCHEDULED_PLAN_CHANGE_CANCELED = "SUBSCRIPTION_SCHEDULED_PLAN_CHANGE_CANCELED",

  SUBSCRIPTION_TRIAL_EXPIRED = "SUBSCRIPTION_TRIAL_EXPIRED",

  SUITE_API_TOKEN_REGENERATED = "SUITE_API_TOKEN_REGENERATED",

  SUITE_CREATED = "SUITE_CREATED",

  SUITE_DELETED = "SUITE_DELETED",

  SUITE_MONITOR_CREATED = "SUITE_MONITOR_CREATED",

  SUITE_MONITOR_DELETED = "SUITE_MONITOR_DELETED",

  SUITE_MONITOR_UPDATED = "SUITE_MONITOR_UPDATED",

  SUITE_SAVED_VIEW_CREATED = "SUITE_SAVED_VIEW_CREATED",

  SUITE_SAVED_VIEW_DELETED = "SUITE_SAVED_VIEW_DELETED",

  SUITE_UPDATED = "SUITE_UPDATED",

  SUITE_VISIBILITY_CHANGED = "SUITE_VISIBILITY_CHANGED",

  SUITE_WORKFLOW_CREATED = "SUITE_WORKFLOW_CREATED",

  SUITE_WORKFLOW_DELETED = "SUITE_WORKFLOW_DELETED",

  SUITE_WORKFLOW_UPDATED = "SUITE_WORKFLOW_UPDATED",

  TEAM_CREATED = "TEAM_CREATED",

  TEAM_DELETED = "TEAM_DELETED",

  TEAM_MEMBER_CREATED = "TEAM_MEMBER_CREATED",

  TEAM_MEMBER_DELETED = "TEAM_MEMBER_DELETED",

  TEAM_MEMBER_UPDATED = "TEAM_MEMBER_UPDATED",

  TEAM_PIPELINE_CREATED = "TEAM_PIPELINE_CREATED",

  TEAM_PIPELINE_DELETED = "TEAM_PIPELINE_DELETED",

  TEAM_PIPELINE_UPDATED = "TEAM_PIPELINE_UPDATED",

  TEAM_REGISTRY_CREATED = "TEAM_REGISTRY_CREATED",

  TEAM_REGISTRY_DELETED = "TEAM_REGISTRY_DELETED",

  TEAM_REGISTRY_UPDATED = "TEAM_REGISTRY_UPDATED",

  TEAM_SECRET_CREATED = "TEAM_SECRET_CREATED",

  TEAM_SECRET_DELETED = "TEAM_SECRET_DELETED",

  TEAM_SECRET_UPDATED = "TEAM_SECRET_UPDATED",

  TEAM_SUITE_CREATED = "TEAM_SUITE_CREATED",

  TEAM_SUITE_DELETED = "TEAM_SUITE_DELETED",

  TEAM_SUITE_UPDATED = "TEAM_SUITE_UPDATED",

  TEAM_UPDATED = "TEAM_UPDATED",

  USER_API_ACCESS_TOKEN_ORGANIZATION_ACCESS_ADDED = "USER_API_ACCESS_TOKEN_ORGANIZATION_ACCESS_ADDED",

  USER_API_ACCESS_TOKEN_ORGANIZATION_ACCESS_REMOVED = "USER_API_ACCESS_TOKEN_ORGANIZATION_ACCESS_REMOVED",

  USER_EMAIL_CREATED = "USER_EMAIL_CREATED",

  USER_EMAIL_DELETED = "USER_EMAIL_DELETED",

  USER_EMAIL_MARKED_PRIMARY = "USER_EMAIL_MARKED_PRIMARY",

  USER_EMAIL_VERIFIED = "USER_EMAIL_VERIFIED",

  USER_IMPERSONATED = "USER_IMPERSONATED",

  USER_PASSWORD_RESET = "USER_PASSWORD_RESET",

  USER_PASSWORD_RESET_REQUESTED = "USER_PASSWORD_RESET_REQUESTED",

  USER_TOTP_ACTIVATED = "USER_TOTP_ACTIVATED",

  USER_TOTP_CREATED = "USER_TOTP_CREATED",

  USER_TOTP_DELETED = "USER_TOTP_DELETED",

  USER_UPDATED = "USER_UPDATED",
}

/**
 * The subject of an AuditEvent
 */
export class AuditSubject extends $Base<"AuditSubject"> {
  constructor() {
    super("AuditSubject")
  }

  /**
   * The GraphQL ID for the subject
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name or short description of this subject
   */
  get name(): $Field<"name", string | null> {
    return this.$_select("name") as any
  }

  /**
   * The node corresponding to the subject, if available
   */
  node<Sel extends Selection<AuditSubjectNode>>(
    selectorFn: (s: AuditSubjectNode) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditSubjectNode()),
    }
    return this.$_select("node", options as any) as any
  }

  /**
   * The type of this subject
   */
  get type(): $Field<"type", AuditSubjectType | null> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID of this subject
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Kinds of subjects which can have audit events performed on them
 */
export class AuditSubjectNode extends $Union<
  {
    APIAccessToken: APIAccessToken
    AgentToken: AgentToken
    AuthorizationBitbucket: AuthorizationBitbucket
    AuthorizationGitHub: AuthorizationGitHub
    AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise
    Cluster: Cluster
    ClusterPermission: ClusterPermission
    ClusterQueue: ClusterQueue
    ClusterQueueToken: ClusterQueueToken
    ClusterToken: ClusterToken
    CompositeRegistryUpstream: CompositeRegistryUpstream
    Email: Email
    JobTypeBlock: JobTypeBlock
    JobTypeCommand: JobTypeCommand
    JobTypeTrigger: JobTypeTrigger
    JobTypeWait: JobTypeWait
    NotificationServiceOpenTelemetryTracing: NotificationServiceOpenTelemetryTracing
    NotificationServiceSlack: NotificationServiceSlack
    NotificationServiceWebhook: NotificationServiceWebhook
    Organization: Organization
    OrganizationBanner: OrganizationBanner
    OrganizationImpersonationRequest: OrganizationImpersonationRequest
    OrganizationInvitation: OrganizationInvitation
    OrganizationMember: OrganizationMember
    OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub
    OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer
    Pipeline: Pipeline
    PipelineSchedule: PipelineSchedule
    PipelineTemplate: PipelineTemplate
    Registry: Registry
    RegistryToken: RegistryToken
    Rule: Rule
    SCMPipelineSettings: SCMPipelineSettings
    SCMRepositoryHost: SCMRepositoryHost
    SCMService: SCMService
    SSOProviderGitHubApp: SSOProviderGitHubApp
    SSOProviderGoogleGSuite: SSOProviderGoogleGSuite
    SSOProviderSAML: SSOProviderSAML
    Secret: Secret
    Subscription: Subscription
    Suite: Suite
    TOTP: TOTP
    Team: Team
    TeamMember: TeamMember
    TeamPipeline: TeamPipeline
    TeamRegistry: TeamRegistry
    TeamSuite: TeamSuite
    User: User
    Node: Node
    Authorization: Authorization
    JobInterface: JobInterface
    NotificationService: NotificationService
    OrganizationRepositoryProvider: OrganizationRepositoryProvider
    SSOProvider: SSOProvider
  },
  "AuditSubjectNode"
> {
  constructor() {
    super({
      APIAccessToken: APIAccessToken,
      AgentToken: AgentToken,
      AuthorizationBitbucket: AuthorizationBitbucket,
      AuthorizationGitHub: AuthorizationGitHub,
      AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise,
      Cluster: Cluster,
      ClusterPermission: ClusterPermission,
      ClusterQueue: ClusterQueue,
      ClusterQueueToken: ClusterQueueToken,
      ClusterToken: ClusterToken,
      CompositeRegistryUpstream: CompositeRegistryUpstream,
      Email: Email,
      JobTypeBlock: JobTypeBlock,
      JobTypeCommand: JobTypeCommand,
      JobTypeTrigger: JobTypeTrigger,
      JobTypeWait: JobTypeWait,
      NotificationServiceOpenTelemetryTracing: NotificationServiceOpenTelemetryTracing,
      NotificationServiceSlack: NotificationServiceSlack,
      NotificationServiceWebhook: NotificationServiceWebhook,
      Organization: Organization,
      OrganizationBanner: OrganizationBanner,
      OrganizationImpersonationRequest: OrganizationImpersonationRequest,
      OrganizationInvitation: OrganizationInvitation,
      OrganizationMember: OrganizationMember,
      OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub,
      OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer,
      Pipeline: Pipeline,
      PipelineSchedule: PipelineSchedule,
      PipelineTemplate: PipelineTemplate,
      Registry: Registry,
      RegistryToken: RegistryToken,
      Rule: Rule,
      SCMPipelineSettings: SCMPipelineSettings,
      SCMRepositoryHost: SCMRepositoryHost,
      SCMService: SCMService,
      SSOProviderGitHubApp: SSOProviderGitHubApp,
      SSOProviderGoogleGSuite: SSOProviderGoogleGSuite,
      SSOProviderSAML: SSOProviderSAML,
      Secret: Secret,
      Subscription: Subscription,
      Suite: Suite,
      TOTP: TOTP,
      Team: Team,
      TeamMember: TeamMember,
      TeamPipeline: TeamPipeline,
      TeamRegistry: TeamRegistry,
      TeamSuite: TeamSuite,
      User: User,
      Node: Node,
      Authorization: Authorization,
      JobInterface: JobInterface,
      NotificationService: NotificationService,
      OrganizationRepositoryProvider: OrganizationRepositoryProvider,
      SSOProvider: SSOProvider,
    }, "AuditSubjectNode")
  }
}

/**
 * All the possible types of subjects in an Audit Event
 */
export enum AuditSubjectType {
  PORTAL_SECRET = "PORTAL_SECRET",

  CLUSTER = "CLUSTER",

  TEAM = "TEAM",

  SECRET = "SECRET",

  AUTHORIZATION = "AUTHORIZATION",

  RULE = "RULE",

  AGENT_TOKEN = "AGENT_TOKEN",

  API_ACCESS_TOKEN = "API_ACCESS_TOKEN",

  CACHE_REGISTRY = "CACHE_REGISTRY",

  CLUSTER_QUEUE = "CLUSTER_QUEUE",

  NOTIFICATION_SERVICE = "NOTIFICATION_SERVICE",

  REGISTRY = "REGISTRY",

  SUBSCRIPTION = "SUBSCRIPTION",

  ORGANIZATION_BILLING_SETTING = "ORGANIZATION_BILLING_SETTING",

  ORGANIZATION_BANNER = "ORGANIZATION_BANNER",

  ORGANIZATION_MEMBER = "ORGANIZATION_MEMBER",

  ORGANIZATION_INVITATION = "ORGANIZATION_INVITATION",

  PIPELINE_SCHEDULE = "PIPELINE_SCHEDULE",

  ORGANIZATION_IMPERSONATION_REQUEST = "ORGANIZATION_IMPERSONATION_REQUEST",

  PORTAL = "PORTAL",

  PIPELINE_TEMPLATE = "PIPELINE_TEMPLATE",

  TEAM_MEMBER = "TEAM_MEMBER",

  PIPELINE = "PIPELINE",

  TEAM_REGISTRY = "TEAM_REGISTRY",

  TEAM_PIPELINE = "TEAM_PIPELINE",

  PORTAL_TOKEN_CODE = "PORTAL_TOKEN_CODE",

  REGISTRY_TOKEN = "REGISTRY_TOKEN",

  SSO_PROVIDER = "SSO_PROVIDER",

  SCM_SERVICE = "SCM_SERVICE",

  SCM_PIPELINE_SETTINGS = "SCM_PIPELINE_SETTINGS",

  JOB = "JOB",

  SCM_REPOSITORY_HOST = "SCM_REPOSITORY_HOST",

  SUITE_SAVED_VIEW = "SUITE_SAVED_VIEW",

  TEAM_SUITE = "TEAM_SUITE",

  SUITE_MONITOR = "SUITE_MONITOR",

  COMPOSITE_REGISTRY_UPSTREAM = "COMPOSITE_REGISTRY_UPSTREAM",

  ORGANIZATION = "ORGANIZATION",

  USER_EMAIL = "USER_EMAIL",

  USER_TOTP = "USER_TOTP",

  TEAM_SECRET = "TEAM_SECRET",

  SUITE_WORKFLOW = "SUITE_WORKFLOW",

  SUITE = "SUITE",

  CLUSTER_PERMISSION = "CLUSTER_PERMISSION",

  USER = "USER",

  CLUSTER_QUEUE_TOKEN = "CLUSTER_QUEUE_TOKEN",

  CLUSTER_TOKEN = "CLUSTER_TOKEN",

  PORTAL_TOKEN = "PORTAL_TOKEN",
}

/**
 * Context for an audit event created during a web request
 */
export class AuditWebContext extends $Base<"AuditWebContext"> {
  constructor() {
    super("AuditWebContext")
  }

  /**
   * The remote IP which made the request
   */
  get requestIpAddress(): $Field<"requestIpAddress", string | null> {
    return this.$_select("requestIpAddress") as any
  }

  /**
   * The client supplied user agent which made the request
   */
  get requestUserAgent(): $Field<"requestUserAgent", string | null> {
    return this.$_select("requestUserAgent") as any
  }

  /**
   * When the session started, if available
   */
  get sessionCreatedAt(): $Field<"sessionCreatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("sessionCreatedAt") as any
  }

  /**
   * When the session was escalated, if available and escalated
   */
  get sessionEscalatedAt(): $Field<"sessionEscalatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("sessionEscalatedAt") as any
  }

  /**
   * The session's authenticated user, if available
   */
  sessionUser<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"sessionUser", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("sessionUser", options as any) as any
  }

  /**
   * The session's authenticated user's uuid
   */
  get sessionUserUuid(): $Field<"sessionUserUuid", string | null> {
    return this.$_select("sessionUserUuid") as any
  }
}

export class Authorization extends $Interface<
  {
    AuthorizationBitbucket: AuthorizationBitbucket
    AuthorizationGitHub: AuthorizationGitHub
    AuthorizationGitHubApp: AuthorizationGitHubApp
    AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise
    AuthorizationGoogle: AuthorizationGoogle
    AuthorizationSAML: AuthorizationSAML
  },
  "Authorization"
> {
  constructor() {
    super({
      AuthorizationBitbucket: AuthorizationBitbucket,
      AuthorizationGitHub: AuthorizationGitHub,
      AuthorizationGitHubApp: AuthorizationGitHubApp,
      AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise,
      AuthorizationGoogle: AuthorizationGoogle,
      AuthorizationSAML: AuthorizationSAML,
    }, "Authorization")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A Bitbucket account authorized with a Buildkite account
 */
export class AuthorizationBitbucket extends $Base<"AuthorizationBitbucket"> {
  constructor() {
    super("AuthorizationBitbucket")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

export class AuthorizationConnection extends $Base<"AuthorizationConnection"> {
  constructor() {
    super("AuthorizationConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<AuthorizationEdge>>(
    selectorFn: (s: AuthorizationEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuthorizationEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class AuthorizationEdge extends $Base<"AuthorizationEdge"> {
  constructor() {
    super("AuthorizationEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Authorization>>(
    selectorFn: (s: Authorization) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Authorization()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * A GitHub account authorized with a Buildkite account
 */
export class AuthorizationGitHub extends $Base<"AuthorizationGitHub"> {
  constructor() {
    super("AuthorizationGitHub")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A GitHub app authorized with a Buildkite account
 */
export class AuthorizationGitHubApp extends $Base<"AuthorizationGitHubApp"> {
  constructor() {
    super("AuthorizationGitHubApp")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A GitHub Enterprise account authorized with a Buildkite account
 */
export class AuthorizationGitHubEnterprise extends $Base<"AuthorizationGitHubEnterprise"> {
  constructor() {
    super("AuthorizationGitHubEnterprise")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A Google account authorized with a Buildkite account
 */
export class AuthorizationGoogle extends $Base<"AuthorizationGoogle"> {
  constructor() {
    super("AuthorizationGoogle")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A SAML account authorized with a Buildkite account
 */
export class AuthorizationSAML extends $Base<"AuthorizationSAML"> {
  constructor() {
    super("AuthorizationSAML")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * The type of the authorization
 */
export enum AuthorizationType {
  /**
   * GitHub Authorization
   */
  GITHUB = "GITHUB",

  /**
   * GitHub Enterprise Authorization
   */
  GITHUB_ENTERPRISE = "GITHUB_ENTERPRISE",

  /**
   * Bitbucket Authorization
   */
  BITBUCKET = "BITBUCKET",
}

/**
 * An avatar belonging to a user
 */
export class Avatar extends $Base<"Avatar"> {
  constructor() {
    super("Avatar")
  }

  /**
   * The URL of the avatar
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }
}

/**
 * A build from a pipeline
 */
export class Build extends $Base<"Build"> {
  constructor() {
    super("Build")
  }

  annotations<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      style?: Readonly<Array<AnnotationStyle>> | null
      order?: AnnotationOrder | null
    }>,
    Sel extends Selection<AnnotationConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      style?: Readonly<Array<AnnotationStyle>> | null
      order?: AnnotationOrder | null
    }>,
    selectorFn: (s: AnnotationConnection) => [...Sel],
  ): $Field<"annotations", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  annotations<Sel extends Selection<AnnotationConnection>>(
    selectorFn: (s: AnnotationConnection) => [...Sel],
  ): $Field<"annotations", GetOutput<Sel> | null, GetVariables<Sel>>
  annotations(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        style: "[AnnotationStyle!]",
        order: "AnnotationOrder",
      },
      args,

      selection: selectorFn(new AnnotationConnection()),
    }
    return this.$_select("annotations", options as any) as any
  }

  /**
   * The current blocked state of the build
   */
  get blockedState(): $Field<"blockedState", BuildBlockedStates | null> {
    return this.$_select("blockedState") as any
  }

  /**
   * The branch for the build
   */
  get branch(): $Field<"branch", string> {
    return this.$_select("branch") as any
  }

  /**
   * The time when the build was cancelled
   */
  get canceledAt(): $Field<"canceledAt", CustomScalar<DateTime> | null> {
    return this.$_select("canceledAt") as any
  }

  /**
   * The user who canceled this build. If the build was canceled, and this value is null, then it was canceled automatically by Buildkite
   */
  canceledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"canceledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("canceledBy", options as any) as any
  }

  /**
   * The fully-qualified commit for the build
   */
  get commit(): $Field<"commit", string> {
    return this.$_select("commit") as any
  }

  /**
   * The time when the build was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  createdBy<Sel extends Selection<BuildCreator>>(
    selectorFn: (s: BuildCreator) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildCreator()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * Custom environment variables passed to this build
   */
  get env(): $Field<"env", Readonly<Array<string>> | null> {
    return this.$_select("env") as any
  }

  /**
   * The time when the build finished
   */
  get finishedAt(): $Field<"finishedAt", CustomScalar<DateTime> | null> {
    return this.$_select("finishedAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  jobs<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    Sel extends Selection<JobConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  jobs<Sel extends Selection<JobConnection>>(
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel>>
  jobs(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        type: "[JobTypes!]",
        state: "[JobStates!]",
        priority: "JobPrioritySearch",
        agentQueryRules: "[String!]",
        concurrency: "JobConcurrencySearch",
        passed: "Boolean",
        step: "JobStepSearch",
        order: "JobOrder",
      },
      args,

      selection: selectorFn(new JobConnection()),
    }
    return this.$_select("jobs", options as any) as any
  }

  /**
   * The message for the build
   */
  get message(): $Field<"message", string | null> {
    return this.$_select("message") as any
  }

  metaData<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<BuildMetaDataConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: BuildMetaDataConnection) => [...Sel],
  ): $Field<"metaData", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  metaData<Sel extends Selection<BuildMetaDataConnection>>(
    selectorFn: (s: BuildMetaDataConnection) => [...Sel],
  ): $Field<"metaData", GetOutput<Sel> | null, GetVariables<Sel>>
  metaData(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new BuildMetaDataConnection()),
    }
    return this.$_select("metaData", options as any) as any
  }

  /**
   * The number of the build
   */
  get number(): $Field<"number", number> {
    return this.$_select("number") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  pullRequest<Sel extends Selection<PullRequest>>(
    selectorFn: (s: PullRequest) => [...Sel],
  ): $Field<"pullRequest", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PullRequest()),
    }
    return this.$_select("pullRequest", options as any) as any
  }

  /**
   * The build that this build was rebuilt from
   */
  rebuiltFrom<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"rebuiltFrom", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("rebuiltFrom", options as any) as any
  }

  /**
   * The time when the build became scheduled for running
   */
  get scheduledAt(): $Field<"scheduledAt", CustomScalar<DateTime> | null> {
    return this.$_select("scheduledAt") as any
  }

  /**
   * Where the build was created
   */
  source<Sel extends Selection<BuildSource>>(
    selectorFn: (s: BuildSource) => [...Sel],
  ): $Field<"source", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildSource()),
    }
    return this.$_select("source", options as any) as any
  }

  /**
   * The time when the build started running
   */
  get startedAt(): $Field<"startedAt", CustomScalar<DateTime> | null> {
    return this.$_select("startedAt") as any
  }

  /**
   * The current state of the build
   */
  get state(): $Field<"state", BuildStates> {
    return this.$_select("state") as any
  }

  /**
   * The job that this build was triggered from
   */
  triggeredFrom<Sel extends Selection<JobTypeTrigger>>(
    selectorFn: (s: JobTypeTrigger) => [...Sel],
  ): $Field<"triggeredFrom", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeTrigger()),
    }
    return this.$_select("triggeredFrom", options as any) as any
  }

  /**
   * The URL for the build
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for the build
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of BuildAnnotate
 */
export type BuildAnnotateInput = {
  append?: boolean | null
  body?: string | null
  buildID: string
  clientMutationId?: string | null
  context?: string | null
  priority?: number | null
  style?: AnnotationStyle | null
}

/**
 * Autogenerated return type of BuildAnnotate.
 */
export class BuildAnnotatePayload extends $Base<"BuildAnnotatePayload"> {
  constructor() {
    super("BuildAnnotatePayload")
  }

  annotation<Sel extends Selection<Annotation>>(
    selectorFn: (s: Annotation) => [...Sel],
  ): $Field<"annotation", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Annotation()),
    }
    return this.$_select("annotation", options as any) as any
  }

  annotationEdge<Sel extends Selection<AnnotationEdge>>(
    selectorFn: (s: AnnotationEdge) => [...Sel],
  ): $Field<"annotationEdge", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AnnotationEdge()),
    }
    return this.$_select("annotationEdge", options as any) as any
  }

  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * Author for a build
 */
export type BuildAuthorInput = {
  email: string
  name: string
}

/**
 * All the possible blocked states a build can be in
 */
export enum BuildBlockedStates {
  /**
   * The blocked build is running
   */
  RUNNING = "RUNNING",

  /**
   * The blocked build is passed
   */
  PASSED = "PASSED",

  /**
   * The blocked build is failed
   */
  FAILED = "FAILED",
}

/**
 * Autogenerated input type of BuildCancel
 */
export type BuildCancelInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of BuildCancel.
 */
export class BuildCancelPayload extends $Base<"BuildCancelPayload"> {
  constructor() {
    super("BuildCancelPayload")
  }

  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

export class BuildConnection extends $Base<"BuildConnection"> {
  constructor() {
    super("BuildConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<BuildEdge>>(
    selectorFn: (s: BuildEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of BuildCreate
 */
export type BuildCreateInput = {
  author?: BuildAuthorInput | null
  branch?: string | null
  clientMutationId?: string | null
  commit?: string | null
  env?: Readonly<Array<string>> | null
  message?: string | null
  metaData?: Readonly<Array<BuildMetaDataInput>> | null
  pipelineID: string
}

/**
 * Autogenerated return type of BuildCreate.
 */
export class BuildCreatePayload extends $Base<"BuildCreatePayload"> {
  constructor() {
    super("BuildCreatePayload")
  }

  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

/**
 * Either a `User` or an `UnregisteredUser` type
 */
export class BuildCreator
  extends $Union<{ UnregisteredUser: UnregisteredUser; User: User; Node: Node }, "BuildCreator"> {
  constructor() {
    super({ UnregisteredUser: UnregisteredUser, User: User, Node: Node }, "BuildCreator")
  }
}

export class BuildEdge extends $Base<"BuildEdge"> {
  constructor() {
    super("BuildEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * A comment on a build
 */
export class BuildMetaData extends $Base<"BuildMetaData"> {
  constructor() {
    super("BuildMetaData")
  }

  /**
   * The key used to set this meta data
   */
  get key(): $Field<"key", string> {
    return this.$_select("key") as any
  }

  /**
   * The value set to this meta data
   */
  get value(): $Field<"value", string> {
    return this.$_select("value") as any
  }
}

export class BuildMetaDataConnection extends $Base<"BuildMetaDataConnection"> {
  constructor() {
    super("BuildMetaDataConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<BuildMetaDataEdge>>(
    selectorFn: (s: BuildMetaDataEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildMetaDataEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class BuildMetaDataEdge extends $Base<"BuildMetaDataEdge"> {
  constructor() {
    super("BuildMetaDataEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<BuildMetaData>>(
    selectorFn: (s: BuildMetaData) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildMetaData()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Meta-data key/value pairs for a build
 */
export type BuildMetaDataInput = {
  key: string
  value: string
}

/**
 * Autogenerated input type of BuildRebuild
 */
export type BuildRebuildInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of BuildRebuild.
 */
export class BuildRebuildPayload extends $Base<"BuildRebuildPayload"> {
  constructor() {
    super("BuildRebuildPayload")
  }

  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  rebuild<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"rebuild", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("rebuild", options as any) as any
  }
}

export class BuildSource extends $Interface<
  {
    BuildSourceAPI: BuildSourceAPI
    BuildSourceFrontend: BuildSourceFrontend
    BuildSourceSchedule: BuildSourceSchedule
    BuildSourceTriggerJob: BuildSourceTriggerJob
    BuildSourceWebhook: BuildSourceWebhook
  },
  "BuildSource"
> {
  constructor() {
    super({
      BuildSourceAPI: BuildSourceAPI,
      BuildSourceFrontend: BuildSourceFrontend,
      BuildSourceSchedule: BuildSourceSchedule,
      BuildSourceTriggerJob: BuildSourceTriggerJob,
      BuildSourceWebhook: BuildSourceWebhook,
    }, "BuildSource")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * A build was triggered via an API
 */
export class BuildSourceAPI extends $Base<"BuildSourceAPI"> {
  constructor() {
    super("BuildSourceAPI")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * A build was triggered manually via the frontend
 */
export class BuildSourceFrontend extends $Base<"BuildSourceFrontend"> {
  constructor() {
    super("BuildSourceFrontend")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * A build was triggered via a schedule
 */
export class BuildSourceSchedule extends $Base<"BuildSourceSchedule"> {
  constructor() {
    super("BuildSourceSchedule")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The associated schedule that created this build. Will be `null` if the associated schedule has been deleted.
   */
  pipelineSchedule<Sel extends Selection<PipelineSchedule>>(
    selectorFn: (s: PipelineSchedule) => [...Sel],
  ): $Field<"pipelineSchedule", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineSchedule()),
    }
    return this.$_select("pipelineSchedule", options as any) as any
  }
}

/**
 * A build was triggered via a trigger job
 */
export class BuildSourceTriggerJob extends $Base<"BuildSourceTriggerJob"> {
  constructor() {
    super("BuildSourceTriggerJob")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * A build was triggered via a Webhook
 */
export class BuildSourceWebhook extends $Base<"BuildSourceWebhook"> {
  constructor() {
    super("BuildSourceWebhook")
  }

  /**
   * Provider specific headers sent along with the webhook. This will return null if the webhook has been purged by Buildkite.
   */
  get headers(): $Field<"headers", Readonly<Array<string>> | null> {
    return this.$_select("headers") as any
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The body of the webhook. Buildkite only stores webhook data for a short period of time, so if this returns null - then the webhook data has been purged by Buildkite
   */
  get payload(): $Field<"payload", CustomScalar<JSON> | null> {
    return this.$_select("payload") as any
  }

  /**
   * The UUID for this webhook. This will return null if the webhook has been purged by Buildkite
   */
  get uuid(): $Field<"uuid", string | null> {
    return this.$_select("uuid") as any
  }
}

/**
 * All the possible states a build can be in
 */
export enum BuildStates {
  /**
   * The build was skipped
   */
  SKIPPED = "SKIPPED",

  /**
   * The build is currently being created
   */
  CREATING = "CREATING",

  /**
   * The build has yet to start running jobs
   */
  SCHEDULED = "SCHEDULED",

  /**
   * The build is currently running jobs
   */
  RUNNING = "RUNNING",

  /**
   * The build passed
   */
  PASSED = "PASSED",

  /**
   * The build failed
   */
  FAILED = "FAILED",

  /**
   * The build is failing
   */
  FAILING = "FAILING",

  /**
   * The build is currently being canceled
   */
  CANCELING = "CANCELING",

  /**
   * The build was canceled
   */
  CANCELED = "CANCELED",

  /**
   * The build is blocked
   */
  BLOCKED = "BLOCKED",

  /**
   * The build wasn't run
   */
  NOT_RUN = "NOT_RUN",
}

/**
 * The results of a `buildkite-agent pipeline upload`
 */
export class BuildStepUpload extends $Base<"BuildStepUpload"> {
  constructor() {
    super("BuildStepUpload")
  }

  /**
   * The uploaded step definition
   */
  definition<Sel extends Selection<BuildStepUploadDefinition>>(
    selectorFn: (s: BuildStepUploadDefinition) => [...Sel],
  ): $Field<"definition", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildStepUploadDefinition()),
    }
    return this.$_select("definition", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The UUID for this build step upload
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The pipeline definition for a step upload
 */
export class BuildStepUploadDefinition extends $Base<"BuildStepUploadDefinition"> {
  constructor() {
    super("BuildStepUploadDefinition")
  }

  /**
   * The uploaded step definition rendered as JSON
   */
  get json(): $Field<"json", string> {
    return this.$_select("json") as any
  }

  /**
   * The uploaded step definition rendered as YAML
   */
  get yaml(): $Field<"yaml", string> {
    return this.$_select("yaml") as any
  }
}

export class Cluster extends $Base<"Cluster"> {
  constructor() {
    super("Cluster")
  }

  /**
   * Returns agent tokens for the Cluster
   */
  agentTokens<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<ClusterAgentTokenConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: ClusterAgentTokenConnection) => [...Sel],
  ): $Field<"agentTokens", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  agentTokens<Sel extends Selection<ClusterAgentTokenConnection>>(
    selectorFn: (s: ClusterAgentTokenConnection) => [...Sel],
  ): $Field<"agentTokens", GetOutput<Sel> | null, GetVariables<Sel>>
  agentTokens(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new ClusterAgentTokenConnection()),
    }
    return this.$_select("agentTokens", options as any) as any
  }

  /**
   * Color hex code for the cluster
   */
  get color(): $Field<"color", string | null> {
    return this.$_select("color") as any
  }

  /**
   * User who created the cluster
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The default queue that agents connecting to the cluster without specifying a queue will accept jobs from
   */
  defaultQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"defaultQueue", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("defaultQueue", options as any) as any
  }

  /**
   * Description of the cluster
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * Emoji for the cluster using Buildkite emoji syntax
   */
  get emoji(): $Field<"emoji", string | null> {
    return this.$_select("emoji") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Name of the cluster
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  queues<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: ClusterQueueOrder | null
    }>,
    Sel extends Selection<ClusterQueueConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: ClusterQueueOrder | null
    }>,
    selectorFn: (s: ClusterQueueConnection) => [...Sel],
  ): $Field<"queues", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  queues<Sel extends Selection<ClusterQueueConnection>>(
    selectorFn: (s: ClusterQueueConnection) => [...Sel],
  ): $Field<"queues", GetOutput<Sel> | null, GetVariables<Sel>>
  queues(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "ClusterQueueOrder",
      },
      args,

      selection: selectorFn(new ClusterQueueConnection()),
    }
    return this.$_select("queues", options as any) as any
  }

  /**
   * The public UUID for this cluster
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class ClusterAgentTokenConnection extends $Base<"ClusterAgentTokenConnection"> {
  constructor() {
    super("ClusterAgentTokenConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<ClusterAgentTokenEdge>>(
    selectorFn: (s: ClusterAgentTokenEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterAgentTokenEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterAgentTokenCreate
 */
export type ClusterAgentTokenCreateInput = {
  allowedIpAddresses?: string | null
  clientMutationId?: string | null
  clusterId: string
  description: string
  expiresAt?: CustomScalar<DateTime> | null
  organizationId: string
}

/**
 * Autogenerated return type of ClusterAgentTokenCreate.
 */
export class ClusterAgentTokenCreatePayload extends $Base<"ClusterAgentTokenCreatePayload"> {
  constructor() {
    super("ClusterAgentTokenCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  clusterAgentToken<Sel extends Selection<ClusterToken>>(
    selectorFn: (s: ClusterToken) => [...Sel],
  ): $Field<"clusterAgentToken", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterToken()),
    }
    return this.$_select("clusterAgentToken", options as any) as any
  }

  /**
   * The token value used to register a new agent token to this cluster. Please ensure to securely copy this value immediately upon generation as it will not be displayed again.
   */
  get tokenValue(): $Field<"tokenValue", string> {
    return this.$_select("tokenValue") as any
  }
}

export class ClusterAgentTokenEdge extends $Base<"ClusterAgentTokenEdge"> {
  constructor() {
    super("ClusterAgentTokenEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<ClusterToken>>(
    selectorFn: (s: ClusterToken) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterToken()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterAgentTokenRevoke
 */
export type ClusterAgentTokenRevokeInput = {
  clientMutationId?: string | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterAgentTokenRevoke.
 */
export class ClusterAgentTokenRevokePayload extends $Base<"ClusterAgentTokenRevokePayload"> {
  constructor() {
    super("ClusterAgentTokenRevokePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedClusterAgentTokenId(): $Field<"deletedClusterAgentTokenId", string> {
    return this.$_select("deletedClusterAgentTokenId") as any
  }
}

/**
 * Autogenerated input type of ClusterAgentTokenUpdate
 */
export type ClusterAgentTokenUpdateInput = {
  allowedIpAddresses?: string | null
  clientMutationId?: string | null
  description: string
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterAgentTokenUpdate.
 */
export class ClusterAgentTokenUpdatePayload extends $Base<"ClusterAgentTokenUpdatePayload"> {
  constructor() {
    super("ClusterAgentTokenUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  clusterAgentToken<Sel extends Selection<ClusterToken>>(
    selectorFn: (s: ClusterToken) => [...Sel],
  ): $Field<"clusterAgentToken", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterToken()),
    }
    return this.$_select("clusterAgentToken", options as any) as any
  }
}

export class ClusterConnection extends $Base<"ClusterConnection"> {
  constructor() {
    super("ClusterConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<ClusterEdge>>(
    selectorFn: (s: ClusterEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterCreate
 */
export type ClusterCreateInput = {
  clientMutationId?: string | null
  color?: string | null
  description?: string | null
  emoji?: string | null
  name: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterCreate.
 */
export class ClusterCreatePayload extends $Base<"ClusterCreatePayload"> {
  constructor() {
    super("ClusterCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterDelete
 */
export type ClusterDeleteInput = {
  clientMutationId?: string | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterDelete.
 */
export class ClusterDeletePayload extends $Base<"ClusterDeletePayload"> {
  constructor() {
    super("ClusterDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedClusterId(): $Field<"deletedClusterId", string> {
    return this.$_select("deletedClusterId") as any
  }
}

export class ClusterEdge extends $Base<"ClusterEdge"> {
  constructor() {
    super("ClusterEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort clusters by
 */
export enum ClusterOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created clusters first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

export class ClusterPermission extends $Base<"ClusterPermission"> {
  constructor() {
    super("ClusterPermission")
  }

  actor<Sel extends Selection<ClusterPermissionActor>>(
    selectorFn: (s: ClusterPermissionActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterPermissionActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  /**
   * Whether the actor can add pipelines to this cluster
   */
  get can_add_pipelines(): $Field<"can_add_pipelines", boolean> {
    return this.$_select("can_add_pipelines") as any
  }

  /**
   * Whether the actor can manage the associated cluster
   */
  get can_manage(): $Field<"can_manage", boolean> {
    return this.$_select("can_manage") as any
  }

  /**
   * Whether the actor can see this cluster's tokens
   */
  get can_see_tokens(): $Field<"can_see_tokens", boolean> {
    return this.$_select("can_see_tokens") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The public UUID for this cluster permission
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Actor to whom a cluster permission is applied
 */
export class ClusterPermissionActor
  extends $Union<{ OrganizationMember: OrganizationMember; Team: Team; Node: Node }, "ClusterPermissionActor"> {
  constructor() {
    super({ OrganizationMember: OrganizationMember, Team: Team, Node: Node }, "ClusterPermissionActor")
  }
}

export class ClusterQueue extends $Base<"ClusterQueue"> {
  constructor() {
    super("ClusterQueue")
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * States whether job dispatch is paused for this cluster queue
   */
  get dispatchPaused(): $Field<"dispatchPaused", boolean> {
    return this.$_select("dispatchPaused") as any
  }

  /**
   * The time this queue was paused
   */
  get dispatchPausedAt(): $Field<"dispatchPausedAt", CustomScalar<DateTime> | null> {
    return this.$_select("dispatchPausedAt") as any
  }

  /**
   * The user who paused this cluster queue
   */
  dispatchPausedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"dispatchPausedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("dispatchPausedBy", options as any) as any
  }

  /**
   * Note describing why job dispatch was paused for this cluster queue
   */
  get dispatchPausedNote(): $Field<"dispatchPausedNote", string | null> {
    return this.$_select("dispatchPausedNote") as any
  }

  /**
   * Whether this queue powers by hosted or self-hosted agents
   */
  get hosted(): $Field<"hosted", boolean> {
    return this.$_select("hosted") as any
  }

  /**
   * Settings for hosted agents used for jobs in this queue
   */
  hostedAgents<Sel extends Selection<HostedAgentQueueSettings>>(
    selectorFn: (s: HostedAgentQueueSettings) => [...Sel],
  ): $Field<"hostedAgents", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new HostedAgentQueueSettings()),
    }
    return this.$_select("hostedAgents", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  get key(): $Field<"key", string> {
    return this.$_select("key") as any
  }

  /**
   * Latest metrics for this cluster queue (only if advanced queue metrics are enabled)
   */
  metrics<Sel extends Selection<ClusterQueueMetrics>>(
    selectorFn: (s: ClusterQueueMetrics) => [...Sel],
  ): $Field<"metrics", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueueMetrics()),
    }
    return this.$_select("metrics", options as any) as any
  }

  /**
   * The health status of stacks associated with this queue
   */
  get stackHealth(): $Field<"stackHealth", string | null> {
    return this.$_select("stackHealth") as any
  }

  /**
   * The public UUID for this cluster queue
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class ClusterQueueConnection extends $Base<"ClusterQueueConnection"> {
  constructor() {
    super("ClusterQueueConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<ClusterQueueEdge>>(
    selectorFn: (s: ClusterQueueEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueueEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterQueueCreate
 */
export type ClusterQueueCreateInput = {
  clientMutationId?: string | null
  clusterId: string
  description?: string | null
  hostedAgents?: HostedAgentsQueueSettingsCreateInput | null
  key: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterQueueCreate.
 */
export class ClusterQueueCreatePayload extends $Base<"ClusterQueueCreatePayload"> {
  constructor() {
    super("ClusterQueueCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  clusterQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"clusterQueue", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("clusterQueue", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterQueueDelete
 */
export type ClusterQueueDeleteInput = {
  clientMutationId?: string | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterQueueDelete.
 */
export class ClusterQueueDeletePayload extends $Base<"ClusterQueueDeletePayload"> {
  constructor() {
    super("ClusterQueueDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedClusterQueueId(): $Field<"deletedClusterQueueId", string> {
    return this.$_select("deletedClusterQueueId") as any
  }
}

export class ClusterQueueEdge extends $Base<"ClusterQueueEdge"> {
  constructor() {
    super("ClusterQueueEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Latest metrics for a cluster queue (time bucket, agent/job counts)
 */
export class ClusterQueueMetrics extends $Base<"ClusterQueueMetrics"> {
  constructor() {
    super("ClusterQueueMetrics")
  }

  /**
   * Number of connected agents in the latest bucket
   */
  get connectedAgentsCount(): $Field<"connectedAgentsCount", number> {
    return this.$_select("connectedAgentsCount") as any
  }

  /**
   * Number of running jobs in the latest bucket
   */
  get runningJobsCount(): $Field<"runningJobsCount", number> {
    return this.$_select("runningJobsCount") as any
  }

  /**
   * The timestamp (start of the most recent time bucket, in UTC)
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * Number of waiting (scheduled) jobs in the latest bucket
   */
  get waitingJobsCount(): $Field<"waitingJobsCount", number> {
    return this.$_select("waitingJobsCount") as any
  }
}

/**
 * The different orders you can sort cluster queues by
 */
export enum ClusterQueueOrder {
  /**
   * Order by key alphabetically
   */
  KEY = "KEY",

  /**
   * Order by the most recently created cluster queues first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Autogenerated input type of ClusterQueuePauseDispatch
 */
export type ClusterQueuePauseDispatchInput = {
  clientMutationId?: string | null
  id: string
  note?: string | null
}

/**
 * Autogenerated return type of ClusterQueuePauseDispatch.
 */
export class ClusterQueuePauseDispatchPayload extends $Base<"ClusterQueuePauseDispatchPayload"> {
  constructor() {
    super("ClusterQueuePauseDispatchPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  queue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"queue", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("queue", options as any) as any
  }
}

/**
 * Autogenerated input type of ClusterQueueResumeDispatch
 */
export type ClusterQueueResumeDispatchInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of ClusterQueueResumeDispatch.
 */
export class ClusterQueueResumeDispatchPayload extends $Base<"ClusterQueueResumeDispatchPayload"> {
  constructor() {
    super("ClusterQueueResumeDispatchPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  queue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"queue", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("queue", options as any) as any
  }
}

/**
 * A token used to register an agent with a Buildkite cluster queue
 */
export class ClusterQueueToken extends $Base<"ClusterQueueToken"> {
  constructor() {
    super("ClusterQueueToken")
  }

  /**
   * A list of CIDR-notation IPv4 addresses from which agents can use this token. Please note that this feature is not yet available to all organizations
   */
  get allowedIpAddresses(): $Field<"allowedIpAddresses", string | null> {
    return this.$_select("allowedIpAddresses") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  clusterQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"clusterQueue", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("clusterQueue", options as any) as any
  }

  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * A description for this cluster queue token
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The public UUID for this cluster queue token
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of ClusterQueueUpdate
 */
export type ClusterQueueUpdateInput = {
  clientMutationId?: string | null
  description?: string | null
  hostedAgents?: HostedAgentsQueueSettingsUpdateInput | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of ClusterQueueUpdate.
 */
export class ClusterQueueUpdatePayload extends $Base<"ClusterQueueUpdatePayload"> {
  constructor() {
    super("ClusterQueueUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  clusterQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"clusterQueue", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("clusterQueue", options as any) as any
  }
}

/**
 * A token used to connect an agent in cluster to Buildkite
 */
export class ClusterToken extends $Base<"ClusterToken"> {
  constructor() {
    super("ClusterToken")
  }

  /**
   * A list of CIDR-notation IPv4 addresses from which agents can use this token. Please note that this feature is not yet available to all organizations
   */
  get allowedIpAddresses(): $Field<"allowedIpAddresses", string | null> {
    return this.$_select("allowedIpAddresses") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * A description about what this cluster agent token is used for
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * The date and time at which this token will expire and no longer be valid. If empty, the token will never expire.
   */
  get expiresAt(): $Field<"expiresAt", CustomScalar<DateTime> | null> {
    return this.$_select("expiresAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The token value used to register a new agent to this tokens cluster. This will soon return an empty string before we finally remove this field.
   */
  get token(): $Field<"token", string> {
    return this.$_select("token") as any
  }

  /**
   * The public UUID for this cluster token
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of ClusterUpdate
 */
export type ClusterUpdateInput = {
  clientMutationId?: string | null
  color?: string | null
  defaultQueueId?: string | null
  description?: string | null
  emoji?: string | null
  id: string
  name?: string | null
  organizationId: string
}

/**
 * Autogenerated return type of ClusterUpdate.
 */
export class ClusterUpdatePayload extends $Base<"ClusterUpdatePayload"> {
  constructor() {
    super("ClusterUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }
}

/**
 * A composite registry's upstream
 */
export class CompositeRegistryUpstream extends $Base<"CompositeRegistryUpstream"> {
  constructor() {
    super("CompositeRegistryUpstream")
  }

  compositeRegistry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"compositeRegistry", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("compositeRegistry", options as any) as any
  }

  /**
   * The time when the upstream was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  registry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("registry", options as any) as any
  }

  /**
   * The time when the upstream was updated
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("updatedAt") as any
  }

  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class Connection extends $Interface<
  {
    AgentConnection: AgentConnection
    AgentTokenConnection: AgentTokenConnection
    AnnotationConnection: AnnotationConnection
    ArtifactConnection: ArtifactConnection
    AuthorizationConnection: AuthorizationConnection
    BuildConnection: BuildConnection
    BuildMetaDataConnection: BuildMetaDataConnection
    ClusterAgentTokenConnection: ClusterAgentTokenConnection
    ClusterConnection: ClusterConnection
    ClusterQueueConnection: ClusterQueueConnection
    DependencyConnection: DependencyConnection
    EmailConnection: EmailConnection
    JobConnection: JobConnection
    JobEventConnection: JobEventConnection
    OrganizationAuditEventConnection: OrganizationAuditEventConnection
    OrganizationConnection: OrganizationConnection
    OrganizationInvitationConnection: OrganizationInvitationConnection
    OrganizationInvitationTeamAssignmentConnection: OrganizationInvitationTeamAssignmentConnection
    OrganizationMemberConnection: OrganizationMemberConnection
    OrganizationMemberPipelineConnection: OrganizationMemberPipelineConnection
    PipelineConnection: PipelineConnection
    PipelineMetricConnection: PipelineMetricConnection
    PipelineScheduleConnection: PipelineScheduleConnection
    PipelineTemplateConnection: PipelineTemplateConnection
    RegistryConnection: RegistryConnection
    RuleConnection: RuleConnection
    SSOAuthorizationConnection: SSOAuthorizationConnection
    SSOProviderConnection: SSOProviderConnection
    SuiteConnection: SuiteConnection
    TeamConnection: TeamConnection
    TeamMemberConnection: TeamMemberConnection
    TeamPipelineConnection: TeamPipelineConnection
    TeamRegistryConnection: TeamRegistryConnection
    TeamSuiteConnection: TeamSuiteConnection
  },
  "Connection"
> {
  constructor() {
    super({
      AgentConnection: AgentConnection,
      AgentTokenConnection: AgentTokenConnection,
      AnnotationConnection: AnnotationConnection,
      ArtifactConnection: ArtifactConnection,
      AuthorizationConnection: AuthorizationConnection,
      BuildConnection: BuildConnection,
      BuildMetaDataConnection: BuildMetaDataConnection,
      ClusterAgentTokenConnection: ClusterAgentTokenConnection,
      ClusterConnection: ClusterConnection,
      ClusterQueueConnection: ClusterQueueConnection,
      DependencyConnection: DependencyConnection,
      EmailConnection: EmailConnection,
      JobConnection: JobConnection,
      JobEventConnection: JobEventConnection,
      OrganizationAuditEventConnection: OrganizationAuditEventConnection,
      OrganizationConnection: OrganizationConnection,
      OrganizationInvitationConnection: OrganizationInvitationConnection,
      OrganizationInvitationTeamAssignmentConnection: OrganizationInvitationTeamAssignmentConnection,
      OrganizationMemberConnection: OrganizationMemberConnection,
      OrganizationMemberPipelineConnection: OrganizationMemberPipelineConnection,
      PipelineConnection: PipelineConnection,
      PipelineMetricConnection: PipelineMetricConnection,
      PipelineScheduleConnection: PipelineScheduleConnection,
      PipelineTemplateConnection: PipelineTemplateConnection,
      RegistryConnection: RegistryConnection,
      RuleConnection: RuleConnection,
      SSOAuthorizationConnection: SSOAuthorizationConnection,
      SSOProviderConnection: SSOProviderConnection,
      SuiteConnection: SuiteConnection,
      TeamConnection: TeamConnection,
      TeamMemberConnection: TeamMemberConnection,
      TeamPipelineConnection: TeamPipelineConnection,
      TeamRegistryConnection: TeamRegistryConnection,
      TeamSuiteConnection: TeamSuiteConnection,
    }, "Connection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * An ISO-8601 encoded UTC date string
 */
export type DateTime = unknown

export class Dependency extends $Base<"Dependency"> {
  constructor() {
    super("Dependency")
  }

  /**
   * Is this dependency allowed to fail
   */
  get allowFailure(): $Field<"allowFailure", boolean> {
    return this.$_select("allowFailure") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The step key or step identifier that this step depends on
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this dependency
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class DependencyConnection extends $Base<"DependencyConnection"> {
  constructor() {
    super("DependencyConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<DependencyEdge>>(
    selectorFn: (s: DependencyEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new DependencyEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class DependencyEdge extends $Base<"DependencyEdge"> {
  constructor() {
    super("DependencyEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Dependency>>(
    selectorFn: (s: Dependency) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Dependency()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * A job dispatch for a particular Organization
 */
export class Dispatch extends $Base<"Dispatch"> {
  constructor() {
    super("Dispatch")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The public UUID for this organization dispatch
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An email address
 */
export class Email extends $Base<"Email"> {
  constructor() {
    super("Email")
  }

  /**
   * The email address
   */
  get address(): $Field<"address", string> {
    return this.$_select("address") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Whether the email address is the user's primary address
   */
  get primary(): $Field<"primary", boolean> {
    return this.$_select("primary") as any
  }

  /**
   * The public UUID for this email
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }

  /**
   * Whether the email address has been verified by the user
   */
  get verified(): $Field<"verified", boolean> {
    return this.$_select("verified") as any
  }
}

/**
 * The connection type for Email.
 */
export class EmailConnection extends $Base<"EmailConnection"> {
  constructor() {
    super("EmailConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  /**
   * A list of edges.
   */
  edges<Sel extends Selection<EmailEdge>>(
    selectorFn: (s: EmailEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new EmailEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  /**
   * A list of nodes.
   */
  nodes<Sel extends Selection<Email>>(
    selectorFn: (s: Email) => [...Sel],
  ): $Field<"nodes", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Email()),
    }
    return this.$_select("nodes", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of EmailCreate
 */
export type EmailCreateInput = {
  address: string
  clientMutationId?: string | null
}

/**
 * Autogenerated return type of EmailCreate.
 */
export class EmailCreatePayload extends $Base<"EmailCreatePayload"> {
  constructor() {
    super("EmailCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  emailEdge<Sel extends Selection<EmailEdge>>(
    selectorFn: (s: EmailEdge) => [...Sel],
  ): $Field<"emailEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new EmailEdge()),
    }
    return this.$_select("emailEdge", options as any) as any
  }

  viewer<Sel extends Selection<Viewer>>(
    selectorFn: (s: Viewer) => [...Sel],
  ): $Field<"viewer", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Viewer()),
    }
    return this.$_select("viewer", options as any) as any
  }
}

/**
 * An edge in a connection.
 */
export class EmailEdge extends $Base<"EmailEdge"> {
  constructor() {
    super("EmailEdge")
  }

  /**
   * A cursor for use in pagination.
   */
  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  /**
   * The item at the end of the edge.
   */
  node<Sel extends Selection<Email>>(
    selectorFn: (s: Email) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Email()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of EmailResendVerification
 */
export type EmailResendVerificationInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of EmailResendVerification.
 */
export class EmailResendVerificationPayload extends $Base<"EmailResendVerificationPayload"> {
  constructor() {
    super("EmailResendVerificationPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  email<Sel extends Selection<Email>>(
    selectorFn: (s: Email) => [...Sel],
  ): $Field<"email", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Email()),
    }
    return this.$_select("email", options as any) as any
  }
}

/**
 * GitHub App Installation Rate Limit (limits set by GitHub)
 */
export class GitHubRateLimit extends $Base<"GitHubRateLimit"> {
  constructor() {
    super("GitHubRateLimit")
  }

  /**
   * The maximum number of requests that Buildkite is permitted to make per hour, as set by GitHub.
   */
  get limit(): $Field<"limit", number> {
    return this.$_select("limit") as any
  }

  /**
   * The number of requests remaining in the current rate limit window.
   */
  get remaining(): $Field<"remaining", number> {
    return this.$_select("remaining") as any
  }

  /**
   * The time at which the current rate limit window resets
   */
  get resetAt(): $Field<"resetAt", CustomScalar<DateTime>> {
    return this.$_select("resetAt") as any
  }

  /**
   * The number of requests remaining in the current rate limit window.
   */
  get used(): $Field<"used", number> {
    return this.$_select("used") as any
  }
}

/**
 * A shared GraphQL query
 */
export class GraphQLSnippet extends $Base<"GraphQLSnippet"> {
  constructor() {
    super("GraphQLSnippet")
  }

  /**
   * When this GraphQL snippet was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The default operation name for this snippet
   */
  get operationName(): $Field<"operationName", string | null> {
    return this.$_select("operationName") as any
  }

  /**
   * The query of this GraphQL snippet
   */
  get query(): $Field<"query", string> {
    return this.$_select("query") as any
  }

  /**
   * The URL for the GraphQL snippet
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The public UUID for this snippet
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of GraphQLSnippetCreate
 */
export type GraphQLSnippetCreateInput = {
  clientMutationId?: string | null
  operationName?: string | null
  query: string
}

/**
 * Autogenerated return type of GraphQLSnippetCreate.
 */
export class GraphQLSnippetCreatePayload extends $Base<"GraphQLSnippetCreatePayload"> {
  constructor() {
    super("GraphQLSnippetCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  graphQLSnippet<Sel extends Selection<GraphQLSnippet>>(
    selectorFn: (s: GraphQLSnippet) => [...Sel],
  ): $Field<"graphQLSnippet", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new GraphQLSnippet()),
    }
    return this.$_select("graphQLSnippet", options as any) as any
  }
}

/**
 * Possible machine architectures for the hosted agent instance
 */
export enum HostedAgentArchitecture {
  /**
   * AMD64
   */
  AMD64 = "AMD64",

  /**
   * ARM64
   */
  ARM64 = "ARM64",
}

/**
 * The hosted agent instance configuration for this cluster queue
 */
export class HostedAgentInstanceShape extends $Base<"HostedAgentInstanceShape"> {
  constructor() {
    super("HostedAgentInstanceShape")
  }

  /**
   * Specifies the architecture of the hosted agent instance, such as AMD64 (x86_64) or ARM64 (AArch64), used in this cluster queue.
   */
  get architecture(): $Field<"architecture", HostedAgentArchitecture | null> {
    return this.$_select("architecture") as any
  }

  /**
   * Specifies the type of machine used for the hosted agent instance in this cluster queue (e.g., Linux or MacOS).
   */
  get machineType(): $Field<"machineType", HostedAgentMachineType | null> {
    return this.$_select("machineType") as any
  }

  /**
   * The amount of memory (in GB) available on each hosted agent instance in this cluster queue.
   */
  get memory(): $Field<"memory", number | null> {
    return this.$_select("memory") as any
  }

  /**
   * Name of the instance shape
   */
  get name(): $Field<"name", HostedAgentInstanceShapeName | null> {
    return this.$_select("name") as any
  }

  /**
   * The overall size classification of the hosted agent instance, combining vCPU and memory, used in this cluster queue.
   */
  get size(): $Field<"size", HostedAgentSize | null> {
    return this.$_select("size") as any
  }

  /**
   * The number of CPU cores allocated to the hosted agent instance in this cluster queue.
   */
  get vcpu(): $Field<"vcpu", number | null> {
    return this.$_select("vcpu") as any
  }
}

/**
 * Possible instance shapes for the hosted agent instance
 */
export enum HostedAgentInstanceShapeName {
  /**
   * Linux 2 vCPU x 4 GB Memory
   */
  LINUX_AMD64_2X4 = "LINUX_AMD64_2X4",

  /**
   * Linux 4 vCPU x 16 GB Memory
   */
  LINUX_AMD64_4X16 = "LINUX_AMD64_4X16",

  /**
   * Linux 8 vCPU x 32 GB Memory
   */
  LINUX_AMD64_8X32 = "LINUX_AMD64_8X32",

  /**
   * Linux 16 vCPU x 64 GB Memory
   */
  LINUX_AMD64_16X64 = "LINUX_AMD64_16X64",

  /**
   * Linux 2 vCPU x 4 GB Memory
   */
  LINUX_ARM64_2X4 = "LINUX_ARM64_2X4",

  /**
   * Linux 4 vCPU x 16 GB Memory
   */
  LINUX_ARM64_4X16 = "LINUX_ARM64_4X16",

  /**
   * Linux 8 vCPU x 32 GB Memory
   */
  LINUX_ARM64_8X32 = "LINUX_ARM64_8X32",

  /**
   * Linux 16 vCPU x 64 GB Memory
   */
  LINUX_ARM64_16X64 = "LINUX_ARM64_16X64",

  /**
   * macOS 4 vCPU x 7 GB Memory
   */
  MACOS_M2_4X7 = "MACOS_M2_4X7",

  /**
   * macOS 6 vCPU x 14 GB Memory
   */
  MACOS_M2_6X14 = "MACOS_M2_6X14",

  /**
   * macOS 12 vCPU x 28 GB Memory
   */
  MACOS_M2_12X28 = "MACOS_M2_12X28",

  /**
   * macOS 12 vCPU x 56 GB Memory
   */
  MACOS_M4_12X56 = "MACOS_M4_12X56",

  /**
   * macOS 6 vCPU x 28 GB Memory
   */
  MACOS_ARM64_M4_6X28 = "MACOS_ARM64_M4_6X28",

  /**
   * macOS 12 vCPU x 56 GB Memory
   */
  MACOS_ARM64_M4_12X56 = "MACOS_ARM64_M4_12X56",
}

/**
 * Configuration options specific to Linux hosted agent instances.
 */
export class HostedAgentLinuxSettings extends $Base<"HostedAgentLinuxSettings"> {
  constructor() {
    super("HostedAgentLinuxSettings")
  }

  /**
   * The image reference of a custom agent base image used by the hosted agent instances in this cluster queue. Note: this must be a public image, or image stored within the hosted agents internal registry.
   */
  get agentImageRef(): $Field<"agentImageRef", string | null> {
    return this.$_select("agentImageRef") as any
  }
}

/**
 * Configuration options for the base image of hosted agent instances on macOS platforms.
 */
export class HostedAgentMacOSSettingsType extends $Base<"HostedAgentMacOSSettingsType"> {
  constructor() {
    super("HostedAgentMacOSSettingsType")
  }

  /**
   * The macOS version to use for macOS hosted agent instances for this cluster queue.
   */
  get macosVersion(): $Field<"macosVersion", HostedAgentMacOSVersion | null> {
    return this.$_select("macosVersion") as any
  }

  /**
   * The Xcode version to pre-select (via xcode-select) on macOS hosted agent instances for this cluster queue.
   */
  get xcodeVersion(): $Field<"xcodeVersion", string | null> {
    return this.$_select("xcodeVersion") as any
  }
}

/**
 * Possible macOS versions for the Hosted Agent instance
 */
export enum HostedAgentMacOSVersion {
  /**
   * macOS Sonoma (14.6.1)
   */
  SONOMA = "SONOMA",

  /**
   * macOS Sequoia (15.5)
   */
  SEQUOIA = "SEQUOIA",

  /**
   * macOS Tahoe (26.0)
   */
  TAHOE = "TAHOE",
}

/**
 * Possible machine types for the hosted agent instance
 */
export enum HostedAgentMachineType {
  /**
   * Linux
   */
  LINUX = "LINUX",

  /**
   * macOS
   */
  MACOS = "MACOS",
}

/**
 * Platform-specific configuration for hosted agent instances.
 */
export class HostedAgentPlatformSettings extends $Base<"HostedAgentPlatformSettings"> {
  constructor() {
    super("HostedAgentPlatformSettings")
  }

  /**
   * Configuration options specific to Linux hosted agent instances.
   */
  linux<Sel extends Selection<HostedAgentLinuxSettings>>(
    selectorFn: (s: HostedAgentLinuxSettings) => [...Sel],
  ): $Field<"linux", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new HostedAgentLinuxSettings()),
    }
    return this.$_select("linux", options as any) as any
  }

  /**
   * Configuration options specific to macOS hosted agent instances.
   */
  macos<Sel extends Selection<HostedAgentMacOSSettingsType>>(
    selectorFn: (s: HostedAgentMacOSSettingsType) => [...Sel],
  ): $Field<"macos", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new HostedAgentMacOSSettingsType()),
    }
    return this.$_select("macos", options as any) as any
  }
}

/**
 * Platform-specific configuration for hosted agent instances.
 */
export class HostedAgentQueueSettings extends $Base<"HostedAgentQueueSettings"> {
  constructor() {
    super("HostedAgentQueueSettings")
  }

  /**
   * The hardware specifications of the hosted agent instance, such as CPU and memory
   */
  instanceShape<Sel extends Selection<HostedAgentInstanceShape>>(
    selectorFn: (s: HostedAgentInstanceShape) => [...Sel],
  ): $Field<"instanceShape", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new HostedAgentInstanceShape()),
    }
    return this.$_select("instanceShape", options as any) as any
  }

  /**
   * Platform-specific configuration for Linux and macOS hosted agents.
   */
  platformSettings<Sel extends Selection<HostedAgentPlatformSettings>>(
    selectorFn: (s: HostedAgentPlatformSettings) => [...Sel],
  ): $Field<"platformSettings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new HostedAgentPlatformSettings()),
    }
    return this.$_select("platformSettings", options as any) as any
  }
}

/**
 * Possible sizes for the hosted agent instance, specifying vCPU and memory allocations.
 */
export enum HostedAgentSize {
  /**
   * Small capacity size: 2 vCPU, 4GB RAM (Linux); 4 vCPU, 7GB RAM (macOS).
   */
  SMALL = "SMALL",

  /**
   * Medium capacity size: 4 vCPU, 16GB RAM (Linux); 6 vCPU, 14GB RAM (macOS).
   */
  MEDIUM = "MEDIUM",

  /**
   * Large capacity size: 8 vCPU, 32GB RAM (Linux); 12 vCPU, 28GB RAM (macOS).
   */
  LARGE = "LARGE",

  /**
   * Extra large capacity size: 12 vCPU, 28GB RAM (Linux); Not applicable for macOS.
   */
  EXTRA_LARGE = "EXTRA_LARGE",
}

/**
 * Settings for Linux hosted agents on this queue
 */
export type HostedAgentsLinuxPlatformSettingsInput = {
  agentImageRef?: string | null
}

/**
 * Settings for Mac hosted agents on this queue
 */
export type HostedAgentsMacosPlatformSettingsInput = {
  macosVersion?: HostedAgentMacOSVersion | null
  xcodeVersion?: string | null
}

/**
 * Settings for hosted agents on this queue
 */
export type HostedAgentsPlatformSettingsInput = {
  linux?: HostedAgentsLinuxPlatformSettingsInput | null
  macos?: HostedAgentsMacosPlatformSettingsInput | null
}

/**
 * Settings for hosted agents on this queue
 */
export type HostedAgentsQueueSettingsCreateInput = {
  instanceShape: HostedAgentInstanceShapeName
  platformSettings?: HostedAgentsPlatformSettingsInput | null
}

/**
 * Settings for hosted agents on this queue
 */
export type HostedAgentsQueueSettingsUpdateInput = {
  agentImageRef?: string | null
  instanceShape?: HostedAgentInstanceShapeName | null
  platformSettings?: HostedAgentsPlatformSettingsInput | null
}

/**
 * Represents non-fractional signed whole numeric values.

`JSInt` can represent values between -(2^53) + 1 and 2^53 - 1.

 */
export type JSInt = number

/**
 * A blob of JSON represented as a pretty formatted string
 */
export type JSON = unknown

/**
 * Kinds of jobs that can exist on a build
 */
export class Job extends $Union<
  {
    JobTypeBlock: JobTypeBlock
    JobTypeCommand: JobTypeCommand
    JobTypeTrigger: JobTypeTrigger
    JobTypeWait: JobTypeWait
    JobInterface: JobInterface
    Node: Node
  },
  "Job"
> {
  constructor() {
    super({
      JobTypeBlock: JobTypeBlock,
      JobTypeCommand: JobTypeCommand,
      JobTypeTrigger: JobTypeTrigger,
      JobTypeWait: JobTypeWait,
      JobInterface: JobInterface,
      Node: Node,
    }, "Job")
  }
}

/**
 * Concurrency configuration for a job
 */
export class JobConcurrency extends $Base<"JobConcurrency"> {
  constructor() {
    super("JobConcurrency")
  }

  /**
   * The concurrency group
   */
  get group(): $Field<"group", string> {
    return this.$_select("group") as any
  }

  /**
   * The maximum amount of jobs in the concurrency that are allowed to run at any given time
   */
  get limit(): $Field<"limit", number> {
    return this.$_select("limit") as any
  }
}

/**
 * Searching for concurrency groups on jobs
 */
export type JobConcurrencySearch = {
  group?: Readonly<Array<string>> | null
}

export class JobConnection extends $Base<"JobConnection"> {
  constructor() {
    super("JobConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<JobEdge>>(
    selectorFn: (s: JobEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class JobEdge extends $Base<"JobEdge"> {
  constructor() {
    super("JobEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("node", options as any) as any
  }
}

export class JobEvent extends $Interface<
  {
    JobEventAssigned: JobEventAssigned
    JobEventBuildStepUploadCreated: JobEventBuildStepUploadCreated
    JobEventCanceled: JobEventCanceled
    JobEventFinished: JobEventFinished
    JobEventGeneric: JobEventGeneric
    JobEventRetried: JobEventRetried
    JobEventRetryFailed: JobEventRetryFailed
    JobEventTimedOut: JobEventTimedOut
  },
  "JobEvent"
> {
  constructor() {
    super({
      JobEventAssigned: JobEventAssigned,
      JobEventBuildStepUploadCreated: JobEventBuildStepUploadCreated,
      JobEventCanceled: JobEventCanceled,
      JobEventFinished: JobEventFinished,
      JobEventGeneric: JobEventGeneric,
      JobEventRetried: JobEventRetried,
      JobEventRetryFailed: JobEventRetryFailed,
      JobEventTimedOut: JobEventTimedOut,
    }, "JobEvent")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The actor who was responsible for the job event
 */
export class JobEventActor extends $Base<"JobEventActor"> {
  constructor() {
    super("JobEventActor")
  }

  /**
   * The node corresponding to this actor if available
   */
  node<Sel extends Selection<JobEventActorNodeUnion>>(
    selectorFn: (s: JobEventActorNodeUnion) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActorNodeUnion()),
    }
    return this.$_select("node", options as any) as any
  }

  /**
   * The type of this actor
   */
  get type(): $Field<"type", JobEventActorType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID of this actor if available
   */
  get uuid(): $Field<"uuid", string | null> {
    return this.$_select("uuid") as any
  }
}

/**
 * Actor types that can create events on a job
 */
export class JobEventActorNodeUnion
  extends $Union<{ Agent: Agent; Dispatch: Dispatch; User: User; Node: Node }, "JobEventActorNodeUnion"> {
  constructor() {
    super({ Agent: Agent, Dispatch: Dispatch, User: User, Node: Node }, "JobEventActorNodeUnion")
  }
}

/**
 * All the actors that can have created a job event
 */
export enum JobEventActorType {
  /**
   * The actor was a user
   */
  USER = "USER",

  /**
   * The actor was an agent
   */
  AGENT = "AGENT",

  /**
   * The actor was the system
   */
  SYSTEM = "SYSTEM",

  /**
   * The actor was the dispatcher
   */
  DISPATCH = "DISPATCH",
}

/**
 * An event created when the dispatcher assigns the job to an agent
 */
export class JobEventAssigned extends $Base<"JobEventAssigned"> {
  constructor() {
    super("JobEventAssigned")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  /**
   * The agent the job was assigned to
   */
  assignedAgent<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"assignedAgent", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("assignedAgent", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An event created when the job creates new build steps via pipeline upload
 */
export class JobEventBuildStepUploadCreated extends $Base<"JobEventBuildStepUploadCreated"> {
  constructor() {
    super("JobEventBuildStepUploadCreated")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  buildStepUpload<Sel extends Selection<BuildStepUpload>>(
    selectorFn: (s: BuildStepUpload) => [...Sel],
  ): $Field<"buildStepUpload", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new BuildStepUpload()),
    }
    return this.$_select("buildStepUpload", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An event created when the job is canceled
 */
export class JobEventCanceled extends $Base<"JobEventCanceled"> {
  constructor() {
    super("JobEventCanceled")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  get exitStatus(): $Field<"exitStatus", JSInt> {
    return this.$_select("exitStatus") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The termination signal which killed the command, if the command was killed
   */
  get signal(): $Field<"signal", string | null> {
    return this.$_select("signal") as any
  }

  /**
   * If the termination signal was sent by the agent, the reason the agent took that action. If this field is null, and the `signal` field is not null, the command was killed by another process or by the operating system.
   */
  get signalReason(): $Field<"signalReason", JobEventSignalReason | null> {
    return this.$_select("signalReason") as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class JobEventConnection extends $Base<"JobEventConnection"> {
  constructor() {
    super("JobEventConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<JobEventEdge>>(
    selectorFn: (s: JobEventEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class JobEventEdge extends $Base<"JobEventEdge"> {
  constructor() {
    super("JobEventEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<JobEvent>>(
    selectorFn: (s: JobEvent) => [...Sel],
  ): $Field<"node", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEvent()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * An event created when the job is finished
 */
export class JobEventFinished extends $Base<"JobEventFinished"> {
  constructor() {
    super("JobEventFinished")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  /**
   * The exit status returned by the command on the agent. A value of `-1` indicates either that the agent was lost or the process was killed. If the process was killed, the `signal` field will be non-null.
   */
  get exitStatus(): $Field<"exitStatus", JSInt> {
    return this.$_select("exitStatus") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The termination signal which killed the command, if the command was killed
   */
  get signal(): $Field<"signal", string | null> {
    return this.$_select("signal") as any
  }

  /**
   * If the termination signal was sent by the agent, the reason the agent took that action. If this field is null, and the `signal` field is not null, the command was killed by another process or by the operating system.
   */
  get signalReason(): $Field<"signalReason", JobEventSignalReason | null> {
    return this.$_select("signalReason") as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A generic event type that doesn't have any additional meta-information associated with the event
 */
export class JobEventGeneric extends $Base<"JobEventGeneric"> {
  constructor() {
    super("JobEventGeneric")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An event created when the job is retried
 */
export class JobEventRetried extends $Base<"JobEventRetried"> {
  constructor() {
    super("JobEventRetried")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  automaticRule<Sel extends Selection<JobRetryRuleAutomatic>>(
    selectorFn: (s: JobRetryRuleAutomatic) => [...Sel],
  ): $Field<"automaticRule", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobRetryRuleAutomatic()),
    }
    return this.$_select("automaticRule", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  retriedInJob<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"retriedInJob", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("retriedInJob", options as any) as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An event created when job fails to retry
 */
export class JobEventRetryFailed extends $Base<"JobEventRetryFailed"> {
  constructor() {
    super("JobEventRetryFailed")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The reason why the job was unable to be retried
   */
  get retryFailedReason(): $Field<"retryFailedReason", string> {
    return this.$_select("retryFailedReason") as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The reason why a signal was sent to the job's process, or why the process did not start
 */
export enum JobEventSignalReason {
  /**
   * The agent sent the signal to the process because the agent was stopped
   */
  AGENT_STOP = "AGENT_STOP",

  /**
   * The agent sent the signal to the process because the job was canceled
   */
  CANCEL = "CANCEL",

  /**
   * The agent was unable to start the job process, often due to memory or resource constraints. Note that in this case, no signal was sent to the process, it simply never started.
   */
  PROCESS_RUN_ERROR = "PROCESS_RUN_ERROR",

  /**
   * The agent refused the job. Note that in this case, no signal was sent to the process, the job was not run at all.
   */
  AGENT_REFUSED = "AGENT_REFUSED",

  /**
   * The agent refused the job because the signature could not be verified. Note that in this case, no signal was sent to the process, the job was not run at all.
   */
  SIGNATURE_REJECTED = "SIGNATURE_REJECTED",

  /**
   * The job couldn't be launched by the stack controlling agents. This could be due to a misconfiguration of the job, or due to a lack of resources.
   */
  STACK_ERROR = "STACK_ERROR",
}

/**
 * An event created when the job is timed out
 */
export class JobEventTimedOut extends $Base<"JobEventTimedOut"> {
  constructor() {
    super("JobEventTimedOut")
  }

  /**
   * The actor that caused this event to occur
   */
  actor<Sel extends Selection<JobEventActor>>(
    selectorFn: (s: JobEventActor) => [...Sel],
  ): $Field<"actor", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobEventActor()),
    }
    return this.$_select("actor", options as any) as any
  }

  get exitStatus(): $Field<"exitStatus", JSInt> {
    return this.$_select("exitStatus") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The job that this event belongs to
   */
  job<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"job", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * The termination signal which killed the command, if the command was killed
   */
  get signal(): $Field<"signal", string | null> {
    return this.$_select("signal") as any
  }

  /**
   * If the termination signal was sent by the agent, the reason the agent took that action. If this field is null, and the `signal` field is not null, the command was killed by another process or by the operating system.
   */
  get signalReason(): $Field<"signalReason", JobEventSignalReason | null> {
    return this.$_select("signalReason") as any
  }

  /**
   * The time when the event occurred
   */
  get timestamp(): $Field<"timestamp", CustomScalar<DateTime>> {
    return this.$_select("timestamp") as any
  }

  /**
   * The type of event
   */
  get type(): $Field<"type", JobEventType> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for this job event
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * All the possible types of events that happen to a Job
 */
export enum JobEventType {
  /**
   * The Job was assigned to an agent
   */
  ASSIGNED = "ASSIGNED",

  /**
   * The agent took too long to accept the job
   */
  ASSIGNED_EXPIRED = "ASSIGNED_EXPIRED",

  /**
   * The Job was accepted by an agent
   */
  ACCEPTED = "ACCEPTED",

  /**
   * The agent took too long to start the job
   */
  ACCEPTED_EXPIRED = "ACCEPTED_EXPIRED",

  /**
   * The Job was started by an agent
   */
  STARTED = "STARTED",

  /**
   * The Job was finished by an agent
   */
  FINISHED = "FINISHED",

  /**
   * The Job was canceled
   */
  CANCELED = "CANCELED",

  /**
   * The Job was timed out
   */
  TIMED_OUT = "TIMED_OUT",

  /**
   * The Job was retried either automatically or by a user
   */
  RETRIED = "RETRIED",

  /**
   * The Job was unable to be retried
   */
  RETRY_FAILED = "RETRY_FAILED",

  /**
   * The Job was changed
   */
  CHANGED = "CHANGED",

  /**
   * The Job was unblocked by a user
   */
  UNBLOCKED = "UNBLOCKED",

  /**
   * The Job was scheduled
   */
  SCHEDULED = "SCHEDULED",

  /**
   * The Job sent a notification
   */
  NOTIFICATION = "NOTIFICATION",

  /**
   * The Job was marked for cancelation by a user
   */
  CANCELATION = "CANCELATION",

  /**
   * The Job is limited by a concurrency group
   */
  LIMITED = "LIMITED",

  /**
   * The Job uploaded steps to the current build
   */
  BUILD_STEP_UPLOAD_CREATED = "BUILD_STEP_UPLOAD_CREATED",

  /**
   * The Job expired before it was started on an agent
   */
  EXPIRED = "EXPIRED",

  /**
   * The agent was stopped while processing this job
   */
  AGENT_STOPPED = "AGENT_STOPPED",

  /**
   * The agent disconnected while processing this job
   */
  AGENT_DISCONNECTED = "AGENT_DISCONNECTED",

  /**
   * The agent was lost while processing this job
   */
  AGENT_LOST = "AGENT_LOST",

  /**
   * The job log exceeded the limit
   */
  LOG_SIZE_LIMIT_EXCEEDED = "LOG_SIZE_LIMIT_EXCEEDED",

  /**
   * The Job was reserved by a stack for later execution
   */
  RESERVED = "RESERVED",

  /**
   * The Job was reserved by a stack but the stack took too long to spin up agent
   */
  RESERVED_EXPIRED = "RESERVED_EXPIRED",
}

export class JobInterface extends $Interface<
  {
    JobTypeBlock: JobTypeBlock
    JobTypeCommand: JobTypeCommand
    JobTypeTrigger: JobTypeTrigger
    JobTypeWait: JobTypeWait
  },
  "JobInterface"
> {
  constructor() {
    super({
      JobTypeBlock: JobTypeBlock,
      JobTypeCommand: JobTypeCommand,
      JobTypeTrigger: JobTypeTrigger,
      JobTypeWait: JobTypeWait,
    }, "JobInterface")
  }

  /**
   * If this job has been retried
   */
  get retried(): $Field<"retried", boolean> {
    return this.$_select("retried") as any
  }

  /**
   * The user that retried this job
   */
  retriedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"retriedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("retriedBy", options as any) as any
  }

  /**
   * The number of times the job has been retried
   */
  get retriesCount(): $Field<"retriesCount", number | null> {
    return this.$_select("retriesCount") as any
  }

  /**
   * The job that was retried to create this job
   */
  retrySource<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"retrySource", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("retrySource", options as any) as any
  }

  /**
   * The type of retry that was performed on this job
   */
  get retryType(): $Field<"retryType", JobRetryTypes | null> {
    return this.$_select("retryType") as any
  }

  /**
   * The UUID for this job
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The different orders you can sort jobs by
 */
export enum JobOrder {
  /**
   * Order by the most recently assigned jobs first
   */
  RECENTLY_ASSIGNED = "RECENTLY_ASSIGNED",

  /**
   * Order by the most recently created jobs first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * The priority with which a job will run
 */
export class JobPriority extends $Base<"JobPriority"> {
  constructor() {
    super("JobPriority")
  }

  get number(): $Field<"number", number | null> {
    return this.$_select("number") as any
  }
}

/**
 * Search jobs by priority
 */
export type JobPrioritySearch = {
  number?: Readonly<Array<number>> | null
}

/**
 * Automatic retry rule configuration
 */
export class JobRetryRuleAutomatic extends $Base<"JobRetryRuleAutomatic"> {
  constructor() {
    super("JobRetryRuleAutomatic")
  }

  get exitStatus(): $Field<"exitStatus", string | null> {
    return this.$_select("exitStatus") as any
  }

  get limit(): $Field<"limit", string | null> {
    return this.$_select("limit") as any
  }

  get signal(): $Field<"signal", string | null> {
    return this.$_select("signal") as any
  }

  get signalReason(): $Field<"signalReason", string | null> {
    return this.$_select("signalReason") as any
  }
}

/**
 * Retry Rules for a job
 */
export class JobRetryRules extends $Base<"JobRetryRules"> {
  constructor() {
    super("JobRetryRules")
  }

  automatic<Sel extends Selection<JobRetryRuleAutomatic>>(
    selectorFn: (s: JobRetryRuleAutomatic) => [...Sel],
  ): $Field<"automatic", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobRetryRuleAutomatic()),
    }
    return this.$_select("automatic", options as any) as any
  }

  get manual(): $Field<"manual", boolean | null> {
    return this.$_select("manual") as any
  }
}

/**
 * The retry types that can be made on a Job
 */
export enum JobRetryTypes {
  MANUAL = "MANUAL",

  AUTOMATIC = "AUTOMATIC",
}

/**
 * All the possible states a job can be in
 */
export enum JobStates {
  /**
   * The job has just been created and doesn't have a state yet
   */
  PENDING = "PENDING",

  /**
   * The job is waiting on a `wait` step to finish
   */
  WAITING = "WAITING",

  /**
   * The job was in a `WAITING` state when the build failed
   */
  WAITING_FAILED = "WAITING_FAILED",

  /**
   * The job is waiting on a `block` step to finish
   */
  BLOCKED = "BLOCKED",

  /**
   * The job was in a `BLOCKED` state when the build failed
   */
  BLOCKED_FAILED = "BLOCKED_FAILED",

  /**
   * This `block` job has been manually unblocked
   */
  UNBLOCKED = "UNBLOCKED",

  /**
   * This `block` job was in an `UNBLOCKED` state when the build failed
   */
  UNBLOCKED_FAILED = "UNBLOCKED_FAILED",

  /**
   * The job is waiting on a concurrency group check before becoming either `LIMITED` or `SCHEDULED`
   */
  LIMITING = "LIMITING",

  /**
   * The job is waiting for jobs with the same concurrency group to finish
   */
  LIMITED = "LIMITED",

  /**
   * The job is reserved by a stack for later execution
   */
  RESERVED = "RESERVED",

  /**
   * The job is scheduled and waiting for an agent
   */
  SCHEDULED = "SCHEDULED",

  /**
   * The job has been assigned to an agent, and it's waiting for it to accept
   */
  ASSIGNED = "ASSIGNED",

  /**
   * The job was accepted by the agent, and now it's waiting to start running
   */
  ACCEPTED = "ACCEPTED",

  /**
   * The job is running
   */
  RUNNING = "RUNNING",

  /**
   * The job has finished
   */
  FINISHED = "FINISHED",

  /**
   * The job is currently canceling
   */
  CANCELING = "CANCELING",

  /**
   * The job was canceled
   */
  CANCELED = "CANCELED",

  /**
   * The job is timing out for taking too long
   */
  TIMING_OUT = "TIMING_OUT",

  /**
   * The job timed out
   */
  TIMED_OUT = "TIMED_OUT",

  /**
   * The job was skipped
   */
  SKIPPED = "SKIPPED",

  /**
   * The jobs configuration means that it can't be run
   */
  BROKEN = "BROKEN",

  /**
   * The job expired before it was started on an agent
   */
  EXPIRED = "EXPIRED",
}

/**
 * Searching for jobs based on step information
 */
export type JobStepSearch = {
  key?: Readonly<Array<string>> | null
}

/**
 * A type of job that requires a user to unblock it before proceeding in a build pipeline
 */
export class JobTypeBlock extends $Base<"JobTypeBlock"> {
  constructor() {
    super("JobTypeBlock")
  }

  /**
   * The build that this job is a part of
   */
  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Whether or not this job can be unblocked yet (may be waiting on another job to finish)
   */
  get isUnblockable(): $Field<"isUnblockable", boolean | null> {
    return this.$_select("isUnblockable") as any
  }

  /**
   * The label of this block step
   */
  get label(): $Field<"label", string | null> {
    return this.$_select("label") as any
  }

  /**
   * If this job has been retried
   */
  get retried(): $Field<"retried", boolean> {
    return this.$_select("retried") as any
  }

  /**
   * The user that retried this job
   */
  retriedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"retriedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("retriedBy", options as any) as any
  }

  /**
   * The number of times the job has been retried
   */
  get retriesCount(): $Field<"retriesCount", number | null> {
    return this.$_select("retriesCount") as any
  }

  /**
   * The job that was retried to create this job
   */
  retrySource<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"retrySource", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("retrySource", options as any) as any
  }

  /**
   * The type of retry that was performed on this job
   */
  get retryType(): $Field<"retryType", JobRetryTypes | null> {
    return this.$_select("retryType") as any
  }

  /**
   * The state of the job
   */
  get state(): $Field<"state", JobStates> {
    return this.$_select("state") as any
  }

  /**
   * The step that defined this job. Some older jobs in the system may not have an associated step
   */
  step<Sel extends Selection<StepInput>>(
    selectorFn: (s: StepInput) => [...Sel],
  ): $Field<"step", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new StepInput()),
    }
    return this.$_select("step", options as any) as any
  }

  /**
   * The time when the job was created
   */
  get unblockedAt(): $Field<"unblockedAt", CustomScalar<DateTime> | null> {
    return this.$_select("unblockedAt") as any
  }

  /**
   * The user that unblocked this job
   */
  unblockedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"unblockedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("unblockedBy", options as any) as any
  }

  /**
   * The UUID for this job
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of JobTypeBlockUnblock
 */
export type JobTypeBlockUnblockInput = {
  clientMutationId?: string | null
  fields?: CustomScalar<JSON> | null
  id: string
}

/**
 * Autogenerated return type of JobTypeBlockUnblock.
 */
export class JobTypeBlockUnblockPayload extends $Base<"JobTypeBlockUnblockPayload"> {
  constructor() {
    super("JobTypeBlockUnblockPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  jobTypeBlock<Sel extends Selection<JobTypeBlock>>(
    selectorFn: (s: JobTypeBlock) => [...Sel],
  ): $Field<"jobTypeBlock", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeBlock()),
    }
    return this.$_select("jobTypeBlock", options as any) as any
  }
}

/**
 * A type of job that runs a command on an agent
 */
export class JobTypeCommand extends $Base<"JobTypeCommand"> {
  constructor() {
    super("JobTypeCommand")
  }

  /**
   * The agent that is running the job
   */
  agent<Sel extends Selection<Agent>>(
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"agent", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Agent()),
    }
    return this.$_select("agent", options as any) as any
  }

  /**
   * The ruleset used to find an agent to run this job
   */
  get agentQueryRules(): $Field<"agentQueryRules", Readonly<Array<string>> | null> {
    return this.$_select("agentQueryRules") as any
  }

  /**
   * Artifacts uploaded to this job
   */
  artifacts<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<ArtifactConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: ArtifactConnection) => [...Sel],
  ): $Field<"artifacts", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  artifacts<Sel extends Selection<ArtifactConnection>>(
    selectorFn: (s: ArtifactConnection) => [...Sel],
  ): $Field<"artifacts", GetOutput<Sel> | null, GetVariables<Sel>>
  artifacts(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new ArtifactConnection()),
    }
    return this.$_select("artifacts", options as any) as any
  }

  /**
   * A glob of files to automatically upload after the job finishes
   */
  get automaticArtifactUploadPaths(): $Field<"automaticArtifactUploadPaths", string | null> {
    return this.$_select("automaticArtifactUploadPaths") as any
  }

  /**
   * The build that this job is a part of
   */
  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * The time when the job was cancelled
   */
  get canceledAt(): $Field<"canceledAt", CustomScalar<DateTime> | null> {
    return this.$_select("canceledAt") as any
  }

  /**
   * The cluster of this job
   */
  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  /**
   * The cluster queue of this job
   */
  clusterQueue<Sel extends Selection<ClusterQueue>>(
    selectorFn: (s: ClusterQueue) => [...Sel],
  ): $Field<"clusterQueue", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ClusterQueue()),
    }
    return this.$_select("clusterQueue", options as any) as any
  }

  /**
   * The command the job will run
   */
  get command(): $Field<"command", string | null> {
    return this.$_select("command") as any
  }

  /**
   * Concurrency information related to a job
   */
  concurrency<Sel extends Selection<JobConcurrency>>(
    selectorFn: (s: JobConcurrency) => [...Sel],
  ): $Field<"concurrency", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobConcurrency()),
    }
    return this.$_select("concurrency", options as any) as any
  }

  /**
   * The time when the job was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * Environment variables for this job
   */
  get env(): $Field<"env", Readonly<Array<string>> | null> {
    return this.$_select("env") as any
  }

  /**
   * Job events
   */
  events<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<JobEventConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: JobEventConnection) => [...Sel],
  ): $Field<"events", GetOutput<Sel>, GetVariables<Sel, Args>>
  events<Sel extends Selection<JobEventConnection>>(
    selectorFn: (s: JobEventConnection) => [...Sel],
  ): $Field<"events", GetOutput<Sel>, GetVariables<Sel>>
  events(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new JobEventConnection()),
    }
    return this.$_select("events", options as any) as any
  }

  /**
   * The exit status returned by the command on the agent
   */
  get exitStatus(): $Field<"exitStatus", string | null> {
    return this.$_select("exitStatus") as any
  }

  /**
   * The time when the job was expired
   */
  get expiredAt(): $Field<"expiredAt", CustomScalar<DateTime> | null> {
    return this.$_select("expiredAt") as any
  }

  /**
   * The time when the job finished
   */
  get finishedAt(): $Field<"finishedAt", CustomScalar<DateTime> | null> {
    return this.$_select("finishedAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The label of the job
   */
  get label(): $Field<"label", string | null> {
    return this.$_select("label") as any
  }

  /**
   * The matrix configuration values for this particular job
   */
  get matrix(): $Field<"matrix", CustomScalar<JSON> | null> {
    return this.$_select("matrix") as any
  }

  /**
   * The index of this job within the parallel job group it is a part of. Null if this job is not part of a parallel job group.
   */
  get parallelGroupIndex(): $Field<"parallelGroupIndex", number | null> {
    return this.$_select("parallelGroupIndex") as any
  }

  /**
   * The total number of jobs in the parallel job group this job is a part of. Null if this job is not part of a parallel job group.
   */
  get parallelGroupTotal(): $Field<"parallelGroupTotal", number | null> {
    return this.$_select("parallelGroupTotal") as any
  }

  /**
   * If the job has finished and passed
   */
  get passed(): $Field<"passed", boolean> {
    return this.$_select("passed") as any
  }

  /**
   * The pipeline that this job is a part of
   */
  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  /**
   * The priority of this job
   */
  priority<Sel extends Selection<JobPriority>>(
    selectorFn: (s: JobPriority) => [...Sel],
  ): $Field<"priority", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobPriority()),
    }
    return this.$_select("priority", options as any) as any
  }

  /**
   * If this job has been retried
   */
  get retried(): $Field<"retried", boolean> {
    return this.$_select("retried") as any
  }

  /**
   * The user that retried this job
   */
  retriedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"retriedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("retriedBy", options as any) as any
  }

  /**
   * The number of times the job has been retried
   */
  get retriesCount(): $Field<"retriesCount", number | null> {
    return this.$_select("retriesCount") as any
  }

  /**
   * Job retry rules
   */
  retryRules<Sel extends Selection<JobRetryRules>>(
    selectorFn: (s: JobRetryRules) => [...Sel],
  ): $Field<"retryRules", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobRetryRules()),
    }
    return this.$_select("retryRules", options as any) as any
  }

  /**
   * The job that was retried to create this job
   */
  retrySource<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"retrySource", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("retrySource", options as any) as any
  }

  /**
   * The type of retry that was performed on this job
   */
  get retryType(): $Field<"retryType", JobRetryTypes | null> {
    return this.$_select("retryType") as any
  }

  /**
   * The time when the job became available to be run by an agent
   */
  get runnableAt(): $Field<"runnableAt", CustomScalar<DateTime> | null> {
    return this.$_select("runnableAt") as any
  }

  /**
   * The time when the job became scheduled for running
   */
  get scheduledAt(): $Field<"scheduledAt", CustomScalar<DateTime> | null> {
    return this.$_select("scheduledAt") as any
  }

  /**
   * The termination signal which killed the command, if the command was killed
   */
  get signal(): $Field<"signal", string | null> {
    return this.$_select("signal") as any
  }

  /**
   * If the termination signal was sent by the agent, the reason the agent took that action. If this field is null, and the `signal` field is not null, the command was killed by another process or by the operating system.
   */
  get signalReason(): $Field<"signalReason", JobEventSignalReason | null> {
    return this.$_select("signalReason") as any
  }

  /**
   * If the job soft failed
   */
  get softFailed(): $Field<"softFailed", boolean> {
    return this.$_select("softFailed") as any
  }

  /**
   * The time when the job started running
   */
  get startedAt(): $Field<"startedAt", CustomScalar<DateTime> | null> {
    return this.$_select("startedAt") as any
  }

  /**
   * The state of the job
   */
  get state(): $Field<"state", JobStates> {
    return this.$_select("state") as any
  }

  /**
   * The step that defined this job. Some older jobs in the system may not have an associated step
   */
  step<Sel extends Selection<StepCommand>>(
    selectorFn: (s: StepCommand) => [...Sel],
  ): $Field<"step", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new StepCommand()),
    }
    return this.$_select("step", options as any) as any
  }

  /**
   * The URL for the job
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for this job
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Autogenerated input type of JobTypeCommandCancel
 */
export type JobTypeCommandCancelInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of JobTypeCommandCancel.
 */
export class JobTypeCommandCancelPayload extends $Base<"JobTypeCommandCancelPayload"> {
  constructor() {
    super("JobTypeCommandCancelPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  jobTypeCommand<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"jobTypeCommand", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("jobTypeCommand", options as any) as any
  }
}

/**
 * Autogenerated input type of JobTypeCommandRetry
 */
export type JobTypeCommandRetryInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of JobTypeCommandRetry.
 */
export class JobTypeCommandRetryPayload extends $Base<"JobTypeCommandRetryPayload"> {
  constructor() {
    super("JobTypeCommandRetryPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  jobTypeCommand<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"jobTypeCommand", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("jobTypeCommand", options as any) as any
  }

  retriedInJobTypeCommand<Sel extends Selection<JobTypeCommand>>(
    selectorFn: (s: JobTypeCommand) => [...Sel],
  ): $Field<"retriedInJobTypeCommand", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new JobTypeCommand()),
    }
    return this.$_select("retriedInJobTypeCommand", options as any) as any
  }
}

/**
 * A type of job that triggers another build on a pipeline
 */
export class JobTypeTrigger extends $Base<"JobTypeTrigger"> {
  constructor() {
    super("JobTypeTrigger")
  }

  /**
   * Whether the triggered build runs asynchronously or not
   */
  get async(): $Field<"async", boolean> {
    return this.$_select("async") as any
  }

  /**
   * The build that this job is a part of
   */
  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The label of this trigger step
   */
  get label(): $Field<"label", string | null> {
    return this.$_select("label") as any
  }

  /**
   * If this job has been retried
   */
  get retried(): $Field<"retried", boolean> {
    return this.$_select("retried") as any
  }

  /**
   * The user that retried this job
   */
  retriedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"retriedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("retriedBy", options as any) as any
  }

  /**
   * The number of times the job has been retried
   */
  get retriesCount(): $Field<"retriesCount", number | null> {
    return this.$_select("retriesCount") as any
  }

  /**
   * The job that was retried to create this job
   */
  retrySource<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"retrySource", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("retrySource", options as any) as any
  }

  /**
   * The type of retry that was performed on this job
   */
  get retryType(): $Field<"retryType", JobRetryTypes | null> {
    return this.$_select("retryType") as any
  }

  /**
   * The state of the job
   */
  get state(): $Field<"state", JobStates> {
    return this.$_select("state") as any
  }

  /**
   * The step that defined this job. Some older jobs in the system may not have an associated step
   */
  step<Sel extends Selection<StepTrigger>>(
    selectorFn: (s: StepTrigger) => [...Sel],
  ): $Field<"step", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new StepTrigger()),
    }
    return this.$_select("step", options as any) as any
  }

  /**
   * The build that this job triggered
   */
  triggered<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"triggered", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("triggered", options as any) as any
  }

  /**
   * The UUID for this job
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A type of job that waits for all previous jobs to pass before proceeding the build pipeline
 */
export class JobTypeWait extends $Base<"JobTypeWait"> {
  constructor() {
    super("JobTypeWait")
  }

  /**
   * The build that this job is a part of
   */
  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The label of this wait step
   */
  get label(): $Field<"label", string | null> {
    return this.$_select("label") as any
  }

  /**
   * If this job has been retried
   */
  get retried(): $Field<"retried", boolean> {
    return this.$_select("retried") as any
  }

  /**
   * The user that retried this job
   */
  retriedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"retriedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("retriedBy", options as any) as any
  }

  /**
   * The number of times the job has been retried
   */
  get retriesCount(): $Field<"retriesCount", number | null> {
    return this.$_select("retriesCount") as any
  }

  /**
   * The job that was retried to create this job
   */
  retrySource<Sel extends Selection<Job>>(
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"retrySource", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Job()),
    }
    return this.$_select("retrySource", options as any) as any
  }

  /**
   * The type of retry that was performed on this job
   */
  get retryType(): $Field<"retryType", JobRetryTypes | null> {
    return this.$_select("retryType") as any
  }

  /**
   * The state of the job
   */
  get state(): $Field<"state", JobStates> {
    return this.$_select("state") as any
  }

  /**
   * The step that defined this job. Some older jobs in the system may not have an associated step
   */
  step<Sel extends Selection<StepWait>>(
    selectorFn: (s: StepWait) => [...Sel],
  ): $Field<"step", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new StepWait()),
    }
    return this.$_select("step", options as any) as any
  }

  /**
   * The UUID for this job
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * All the possible types of jobs that can exist
 */
export enum JobTypes {
  /**
   * A job that runs a command on an agent
   */
  COMMAND = "COMMAND",

  /**
   * A job that waits for all previous jobs to finish
   */
  WAIT = "WAIT",

  /**
   * A job that blocks a pipeline from progressing until it's manually unblocked
   */
  BLOCK = "BLOCK",

  /**
   * A job that triggers another build on a pipeline
   */
  TRIGGER = "TRIGGER",
}

/**
 * The root for mutations in this schema
 */
export class Mutation extends $Base<"Mutation"> {
  constructor() {
    super("Mutation")
  }

  /**
   * Pause an agent, preventing dispatch of new jobs but allowing any existing job to finish
   */
  agentPause<
    Args extends VariabledInput<{
      input: AgentPauseInput
    }>,
    Sel extends Selection<AgentPausePayload>,
  >(
    args: ExactArgNames<Args, {
      input: AgentPauseInput
    }>,
    selectorFn: (s: AgentPausePayload) => [...Sel],
  ): $Field<"agentPause", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "AgentPauseInput!",
      },
      args,

      selection: selectorFn(new AgentPausePayload()),
    }
    return this.$_select("agentPause", options as any) as any
  }

  /**
   * Resume a paused agent, allowing it to run jobs again
   */
  agentResume<
    Args extends VariabledInput<{
      input: AgentResumeInput
    }>,
    Sel extends Selection<AgentResumePayload>,
  >(
    args: ExactArgNames<Args, {
      input: AgentResumeInput
    }>,
    selectorFn: (s: AgentResumePayload) => [...Sel],
  ): $Field<"agentResume", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "AgentResumeInput!",
      },
      args,

      selection: selectorFn(new AgentResumePayload()),
    }
    return this.$_select("agentResume", options as any) as any
  }

  /**
   * Instruct an agent to stop accepting new build jobs and shut itself down.
   */
  agentStop<
    Args extends VariabledInput<{
      input: AgentStopInput
    }>,
    Sel extends Selection<AgentStopPayload>,
  >(
    args: ExactArgNames<Args, {
      input: AgentStopInput
    }>,
    selectorFn: (s: AgentStopPayload) => [...Sel],
  ): $Field<"agentStop", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "AgentStopInput!",
      },
      args,

      selection: selectorFn(new AgentStopPayload()),
    }
    return this.$_select("agentStop", options as any) as any
  }

  /**
   * Create a new unclustered agent token.
   */
  agentTokenCreate<
    Args extends VariabledInput<{
      input: AgentTokenCreateInput
    }>,
    Sel extends Selection<AgentTokenCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: AgentTokenCreateInput
    }>,
    selectorFn: (s: AgentTokenCreatePayload) => [...Sel],
  ): $Field<"agentTokenCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "AgentTokenCreateInput!",
      },
      args,

      selection: selectorFn(new AgentTokenCreatePayload()),
    }
    return this.$_select("agentTokenCreate", options as any) as any
  }

  /**
   * Revoke an unclustered agent token.
   */
  agentTokenRevoke<
    Args extends VariabledInput<{
      input: AgentTokenRevokeInput
    }>,
    Sel extends Selection<AgentTokenRevokePayload>,
  >(
    args: ExactArgNames<Args, {
      input: AgentTokenRevokeInput
    }>,
    selectorFn: (s: AgentTokenRevokePayload) => [...Sel],
  ): $Field<"agentTokenRevoke", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "AgentTokenRevokeInput!",
      },
      args,

      selection: selectorFn(new AgentTokenRevokePayload()),
    }
    return this.$_select("agentTokenRevoke", options as any) as any
  }

  /**
   * Authorize an API Access Token Code generated by an API Application. Please note this mutation is private and cannot be executed externally.
   */
  apiAccessTokenCodeAuthorize<
    Args extends VariabledInput<{
      input: APIAccessTokenCodeAuthorizeMutationInput
    }>,
    Sel extends Selection<APIAccessTokenCodeAuthorizeMutationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: APIAccessTokenCodeAuthorizeMutationInput
    }>,
    selectorFn: (s: APIAccessTokenCodeAuthorizeMutationPayload) => [...Sel],
  ): $Field<"apiAccessTokenCodeAuthorize", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "APIAccessTokenCodeAuthorizeMutationInput!",
      },
      args,

      selection: selectorFn(new APIAccessTokenCodeAuthorizeMutationPayload()),
    }
    return this.$_select("apiAccessTokenCodeAuthorize", options as any) as any
  }

  /**
   * Annotate a build with information to appear on the build page.
   */
  buildAnnotate<
    Args extends VariabledInput<{
      input: BuildAnnotateInput
    }>,
    Sel extends Selection<BuildAnnotatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: BuildAnnotateInput
    }>,
    selectorFn: (s: BuildAnnotatePayload) => [...Sel],
  ): $Field<"buildAnnotate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "BuildAnnotateInput!",
      },
      args,

      selection: selectorFn(new BuildAnnotatePayload()),
    }
    return this.$_select("buildAnnotate", options as any) as any
  }

  /**
   * Cancel a build.
   */
  buildCancel<
    Args extends VariabledInput<{
      input: BuildCancelInput
    }>,
    Sel extends Selection<BuildCancelPayload>,
  >(
    args: ExactArgNames<Args, {
      input: BuildCancelInput
    }>,
    selectorFn: (s: BuildCancelPayload) => [...Sel],
  ): $Field<"buildCancel", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "BuildCancelInput!",
      },
      args,

      selection: selectorFn(new BuildCancelPayload()),
    }
    return this.$_select("buildCancel", options as any) as any
  }

  /**
   * Create a build.
   */
  buildCreate<
    Args extends VariabledInput<{
      input: BuildCreateInput
    }>,
    Sel extends Selection<BuildCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: BuildCreateInput
    }>,
    selectorFn: (s: BuildCreatePayload) => [...Sel],
  ): $Field<"buildCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "BuildCreateInput!",
      },
      args,

      selection: selectorFn(new BuildCreatePayload()),
    }
    return this.$_select("buildCreate", options as any) as any
  }

  /**
   * Rebuild a build.
   */
  buildRebuild<
    Args extends VariabledInput<{
      input: BuildRebuildInput
    }>,
    Sel extends Selection<BuildRebuildPayload>,
  >(
    args: ExactArgNames<Args, {
      input: BuildRebuildInput
    }>,
    selectorFn: (s: BuildRebuildPayload) => [...Sel],
  ): $Field<"buildRebuild", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "BuildRebuildInput!",
      },
      args,

      selection: selectorFn(new BuildRebuildPayload()),
    }
    return this.$_select("buildRebuild", options as any) as any
  }

  /**
   * Create an agent token for a cluster.
   */
  clusterAgentTokenCreate<
    Args extends VariabledInput<{
      input: ClusterAgentTokenCreateInput
    }>,
    Sel extends Selection<ClusterAgentTokenCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterAgentTokenCreateInput
    }>,
    selectorFn: (s: ClusterAgentTokenCreatePayload) => [...Sel],
  ): $Field<"clusterAgentTokenCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterAgentTokenCreateInput!",
      },
      args,

      selection: selectorFn(new ClusterAgentTokenCreatePayload()),
    }
    return this.$_select("clusterAgentTokenCreate", options as any) as any
  }

  /**
   * Revokes an agent token for a cluster.
   */
  clusterAgentTokenRevoke<
    Args extends VariabledInput<{
      input: ClusterAgentTokenRevokeInput
    }>,
    Sel extends Selection<ClusterAgentTokenRevokePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterAgentTokenRevokeInput
    }>,
    selectorFn: (s: ClusterAgentTokenRevokePayload) => [...Sel],
  ): $Field<"clusterAgentTokenRevoke", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterAgentTokenRevokeInput!",
      },
      args,

      selection: selectorFn(new ClusterAgentTokenRevokePayload()),
    }
    return this.$_select("clusterAgentTokenRevoke", options as any) as any
  }

  /**
   * Updates an agent token for a cluster.
   */
  clusterAgentTokenUpdate<
    Args extends VariabledInput<{
      input: ClusterAgentTokenUpdateInput
    }>,
    Sel extends Selection<ClusterAgentTokenUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterAgentTokenUpdateInput
    }>,
    selectorFn: (s: ClusterAgentTokenUpdatePayload) => [...Sel],
  ): $Field<"clusterAgentTokenUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterAgentTokenUpdateInput!",
      },
      args,

      selection: selectorFn(new ClusterAgentTokenUpdatePayload()),
    }
    return this.$_select("clusterAgentTokenUpdate", options as any) as any
  }

  /**
   * Create a cluster.
   */
  clusterCreate<
    Args extends VariabledInput<{
      input: ClusterCreateInput
    }>,
    Sel extends Selection<ClusterCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterCreateInput
    }>,
    selectorFn: (s: ClusterCreatePayload) => [...Sel],
  ): $Field<"clusterCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterCreateInput!",
      },
      args,

      selection: selectorFn(new ClusterCreatePayload()),
    }
    return this.$_select("clusterCreate", options as any) as any
  }

  /**
   * Delete a cluster.
   */
  clusterDelete<
    Args extends VariabledInput<{
      input: ClusterDeleteInput
    }>,
    Sel extends Selection<ClusterDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterDeleteInput
    }>,
    selectorFn: (s: ClusterDeletePayload) => [...Sel],
  ): $Field<"clusterDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterDeleteInput!",
      },
      args,

      selection: selectorFn(new ClusterDeletePayload()),
    }
    return this.$_select("clusterDelete", options as any) as any
  }

  /**
   * Create a cluster queue.
   */
  clusterQueueCreate<
    Args extends VariabledInput<{
      input: ClusterQueueCreateInput
    }>,
    Sel extends Selection<ClusterQueueCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterQueueCreateInput
    }>,
    selectorFn: (s: ClusterQueueCreatePayload) => [...Sel],
  ): $Field<"clusterQueueCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterQueueCreateInput!",
      },
      args,

      selection: selectorFn(new ClusterQueueCreatePayload()),
    }
    return this.$_select("clusterQueueCreate", options as any) as any
  }

  /**
   * Delete a cluster queue.
   */
  clusterQueueDelete<
    Args extends VariabledInput<{
      input: ClusterQueueDeleteInput
    }>,
    Sel extends Selection<ClusterQueueDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterQueueDeleteInput
    }>,
    selectorFn: (s: ClusterQueueDeletePayload) => [...Sel],
  ): $Field<"clusterQueueDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterQueueDeleteInput!",
      },
      args,

      selection: selectorFn(new ClusterQueueDeletePayload()),
    }
    return this.$_select("clusterQueueDelete", options as any) as any
  }

  /**
   * This will prevent dispatch of jobs to agents on this queue. You can add an optional note describing the reason for pausing.
   */
  clusterQueuePauseDispatch<
    Args extends VariabledInput<{
      input: ClusterQueuePauseDispatchInput
    }>,
    Sel extends Selection<ClusterQueuePauseDispatchPayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterQueuePauseDispatchInput
    }>,
    selectorFn: (s: ClusterQueuePauseDispatchPayload) => [...Sel],
  ): $Field<"clusterQueuePauseDispatch", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterQueuePauseDispatchInput!",
      },
      args,

      selection: selectorFn(new ClusterQueuePauseDispatchPayload()),
    }
    return this.$_select("clusterQueuePauseDispatch", options as any) as any
  }

  /**
   * This will resume dispatch of jobs on this queue.
   */
  clusterQueueResumeDispatch<
    Args extends VariabledInput<{
      input: ClusterQueueResumeDispatchInput
    }>,
    Sel extends Selection<ClusterQueueResumeDispatchPayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterQueueResumeDispatchInput
    }>,
    selectorFn: (s: ClusterQueueResumeDispatchPayload) => [...Sel],
  ): $Field<"clusterQueueResumeDispatch", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterQueueResumeDispatchInput!",
      },
      args,

      selection: selectorFn(new ClusterQueueResumeDispatchPayload()),
    }
    return this.$_select("clusterQueueResumeDispatch", options as any) as any
  }

  /**
   * Updates a cluster queue.
   */
  clusterQueueUpdate<
    Args extends VariabledInput<{
      input: ClusterQueueUpdateInput
    }>,
    Sel extends Selection<ClusterQueueUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterQueueUpdateInput
    }>,
    selectorFn: (s: ClusterQueueUpdatePayload) => [...Sel],
  ): $Field<"clusterQueueUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterQueueUpdateInput!",
      },
      args,

      selection: selectorFn(new ClusterQueueUpdatePayload()),
    }
    return this.$_select("clusterQueueUpdate", options as any) as any
  }

  /**
   * Updates a cluster.
   */
  clusterUpdate<
    Args extends VariabledInput<{
      input: ClusterUpdateInput
    }>,
    Sel extends Selection<ClusterUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: ClusterUpdateInput
    }>,
    selectorFn: (s: ClusterUpdatePayload) => [...Sel],
  ): $Field<"clusterUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "ClusterUpdateInput!",
      },
      args,

      selection: selectorFn(new ClusterUpdatePayload()),
    }
    return this.$_select("clusterUpdate", options as any) as any
  }

  /**
   * Add a new email address for the current user
   */
  emailCreate<
    Args extends VariabledInput<{
      input: EmailCreateInput
    }>,
    Sel extends Selection<EmailCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: EmailCreateInput
    }>,
    selectorFn: (s: EmailCreatePayload) => [...Sel],
  ): $Field<"emailCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "EmailCreateInput!",
      },
      args,

      selection: selectorFn(new EmailCreatePayload()),
    }
    return this.$_select("emailCreate", options as any) as any
  }

  /**
   * Resend a verification email.
   */
  emailResendVerification<
    Args extends VariabledInput<{
      input: EmailResendVerificationInput
    }>,
    Sel extends Selection<EmailResendVerificationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: EmailResendVerificationInput
    }>,
    selectorFn: (s: EmailResendVerificationPayload) => [...Sel],
  ): $Field<"emailResendVerification", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "EmailResendVerificationInput!",
      },
      args,

      selection: selectorFn(new EmailResendVerificationPayload()),
    }
    return this.$_select("emailResendVerification", options as any) as any
  }

  /**
   * Create a GraphQL snippet.
   */
  graphQLSnippetCreate<
    Args extends VariabledInput<{
      input: GraphQLSnippetCreateInput
    }>,
    Sel extends Selection<GraphQLSnippetCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: GraphQLSnippetCreateInput
    }>,
    selectorFn: (s: GraphQLSnippetCreatePayload) => [...Sel],
  ): $Field<"graphQLSnippetCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "GraphQLSnippetCreateInput!",
      },
      args,

      selection: selectorFn(new GraphQLSnippetCreatePayload()),
    }
    return this.$_select("graphQLSnippetCreate", options as any) as any
  }

  /**
   * Unblocks a build's "Block pipeline" job.
   */
  jobTypeBlockUnblock<
    Args extends VariabledInput<{
      input: JobTypeBlockUnblockInput
    }>,
    Sel extends Selection<JobTypeBlockUnblockPayload>,
  >(
    args: ExactArgNames<Args, {
      input: JobTypeBlockUnblockInput
    }>,
    selectorFn: (s: JobTypeBlockUnblockPayload) => [...Sel],
  ): $Field<"jobTypeBlockUnblock", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "JobTypeBlockUnblockInput!",
      },
      args,

      selection: selectorFn(new JobTypeBlockUnblockPayload()),
    }
    return this.$_select("jobTypeBlockUnblock", options as any) as any
  }

  /**
   * Cancel a job.
   */
  jobTypeCommandCancel<
    Args extends VariabledInput<{
      input: JobTypeCommandCancelInput
    }>,
    Sel extends Selection<JobTypeCommandCancelPayload>,
  >(
    args: ExactArgNames<Args, {
      input: JobTypeCommandCancelInput
    }>,
    selectorFn: (s: JobTypeCommandCancelPayload) => [...Sel],
  ): $Field<"jobTypeCommandCancel", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "JobTypeCommandCancelInput!",
      },
      args,

      selection: selectorFn(new JobTypeCommandCancelPayload()),
    }
    return this.$_select("jobTypeCommandCancel", options as any) as any
  }

  /**
   * Retry a job.
   */
  jobTypeCommandRetry<
    Args extends VariabledInput<{
      input: JobTypeCommandRetryInput
    }>,
    Sel extends Selection<JobTypeCommandRetryPayload>,
  >(
    args: ExactArgNames<Args, {
      input: JobTypeCommandRetryInput
    }>,
    selectorFn: (s: JobTypeCommandRetryPayload) => [...Sel],
  ): $Field<"jobTypeCommandRetry", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "JobTypeCommandRetryInput!",
      },
      args,

      selection: selectorFn(new JobTypeCommandRetryPayload()),
    }
    return this.$_select("jobTypeCommandRetry", options as any) as any
  }

  /**
   * Dismisses a notice from the Buildkite UI. This mutation is idempotent so if you dismiss the same notice multiple times, it will return the original `dismissedAt` time
   */
  noticeDismiss<
    Args extends VariabledInput<{
      input: NoticeDismissInput
    }>,
    Sel extends Selection<NoticeDismissPayload>,
  >(
    args: ExactArgNames<Args, {
      input: NoticeDismissInput
    }>,
    selectorFn: (s: NoticeDismissPayload) => [...Sel],
  ): $Field<"noticeDismiss", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "NoticeDismissInput!",
      },
      args,

      selection: selectorFn(new NoticeDismissPayload()),
    }
    return this.$_select("noticeDismiss", options as any) as any
  }

  /**
   * Revokes access to an organization for a user's API access token. The organization can not be re-added to the same token, however the user can create a new token and add the organization to that token.
   */
  organizationApiAccessTokenRevoke<
    Args extends VariabledInput<{
      input: OrganizationAPIAccessTokenRevokeMutationInput
    }>,
    Sel extends Selection<OrganizationAPIAccessTokenRevokeMutationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationAPIAccessTokenRevokeMutationInput
    }>,
    selectorFn: (s: OrganizationAPIAccessTokenRevokeMutationPayload) => [...Sel],
  ): $Field<"organizationApiAccessTokenRevoke", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationAPIAccessTokenRevokeMutationInput!",
      },
      args,

      selection: selectorFn(new OrganizationAPIAccessTokenRevokeMutationPayload()),
    }
    return this.$_select("organizationApiAccessTokenRevoke", options as any) as any
  }

  /**
   * Sets an allowlist of IP addresses for API access to an organization. Please note that this is a beta feature and is not yet available to all organizations.
   */
  organizationApiIpAllowlistUpdate<
    Args extends VariabledInput<{
      input: OrganizationAPIIPAllowlistUpdateMutationInput
    }>,
    Sel extends Selection<OrganizationAPIIPAllowlistUpdateMutationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationAPIIPAllowlistUpdateMutationInput
    }>,
    selectorFn: (s: OrganizationAPIIPAllowlistUpdateMutationPayload) => [...Sel],
  ): $Field<"organizationApiIpAllowlistUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationAPIIPAllowlistUpdateMutationInput!",
      },
      args,

      selection: selectorFn(new OrganizationAPIIPAllowlistUpdateMutationPayload()),
    }
    return this.$_select("organizationApiIpAllowlistUpdate", options as any) as any
  }

  /**
   * Delete the system banner
   */
  organizationBannerDelete<
    Args extends VariabledInput<{
      input: OrganizationBannerDeleteInput
    }>,
    Sel extends Selection<OrganizationBannerDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationBannerDeleteInput
    }>,
    selectorFn: (s: OrganizationBannerDeletePayload) => [...Sel],
  ): $Field<"organizationBannerDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationBannerDeleteInput!",
      },
      args,

      selection: selectorFn(new OrganizationBannerDeletePayload()),
    }
    return this.$_select("organizationBannerDelete", options as any) as any
  }

  /**
   * Retrieves the active system banner for provided organization, then updates it with input data. If active banner is not found, a new banner is created with the provided input.
   */
  organizationBannerUpsert<
    Args extends VariabledInput<{
      input: OrganizationBannerUpsertInput
    }>,
    Sel extends Selection<OrganizationBannerUpsertPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationBannerUpsertInput
    }>,
    selectorFn: (s: OrganizationBannerUpsertPayload) => [...Sel],
  ): $Field<"organizationBannerUpsert", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationBannerUpsertInput!",
      },
      args,

      selection: selectorFn(new OrganizationBannerUpsertPayload()),
    }
    return this.$_select("organizationBannerUpsert", options as any) as any
  }

  /**
   * Sets whether the organization requires two-factor authentication for all members.
   */
  organizationEnforceTwoFactorAuthenticationForMembersUpdate<
    Args extends VariabledInput<{
      input: OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationInput
    }>,
    Sel extends Selection<OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationInput
    }>,
    selectorFn: (s: OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload) => [...Sel],
  ): $Field<
    "organizationEnforceTwoFactorAuthenticationForMembersUpdate",
    GetOutput<Sel> | null,
    GetVariables<Sel, Args>
  > {
    const options = {
      argTypes: {
        input: "OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationInput!",
      },
      args,

      selection: selectorFn(new OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload()),
    }
    return this.$_select("organizationEnforceTwoFactorAuthenticationForMembersUpdate", options as any) as any
  }

  /**
   * Send email invitations to this organization.
   */
  organizationInvitationCreate<
    Args extends VariabledInput<{
      input: OrganizationInvitationCreateInput
    }>,
    Sel extends Selection<OrganizationInvitationCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationInvitationCreateInput
    }>,
    selectorFn: (s: OrganizationInvitationCreatePayload) => [...Sel],
  ): $Field<"organizationInvitationCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationInvitationCreateInput!",
      },
      args,

      selection: selectorFn(new OrganizationInvitationCreatePayload()),
    }
    return this.$_select("organizationInvitationCreate", options as any) as any
  }

  /**
   * Resend an organization invitation email.
   */
  organizationInvitationResend<
    Args extends VariabledInput<{
      input: OrganizationInvitationResendInput
    }>,
    Sel extends Selection<OrganizationInvitationResendPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationInvitationResendInput
    }>,
    selectorFn: (s: OrganizationInvitationResendPayload) => [...Sel],
  ): $Field<"organizationInvitationResend", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationInvitationResendInput!",
      },
      args,

      selection: selectorFn(new OrganizationInvitationResendPayload()),
    }
    return this.$_select("organizationInvitationResend", options as any) as any
  }

  /**
   * Revoke an invitation to an organization so that it can no longer be accepted.
   */
  organizationInvitationRevoke<
    Args extends VariabledInput<{
      input: OrganizationInvitationRevokeInput
    }>,
    Sel extends Selection<OrganizationInvitationRevokePayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationInvitationRevokeInput
    }>,
    selectorFn: (s: OrganizationInvitationRevokePayload) => [...Sel],
  ): $Field<"organizationInvitationRevoke", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationInvitationRevokeInput!",
      },
      args,

      selection: selectorFn(new OrganizationInvitationRevokePayload()),
    }
    return this.$_select("organizationInvitationRevoke", options as any) as any
  }

  /**
   * Remove a user from an organization.
   */
  organizationMemberDelete<
    Args extends VariabledInput<{
      input: OrganizationMemberDeleteInput
    }>,
    Sel extends Selection<OrganizationMemberDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationMemberDeleteInput
    }>,
    selectorFn: (s: OrganizationMemberDeletePayload) => [...Sel],
  ): $Field<"organizationMemberDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationMemberDeleteInput!",
      },
      args,

      selection: selectorFn(new OrganizationMemberDeletePayload()),
    }
    return this.$_select("organizationMemberDelete", options as any) as any
  }

  /**
   * Change a user's role within an organization.
   */
  organizationMemberUpdate<
    Args extends VariabledInput<{
      input: OrganizationMemberUpdateInput
    }>,
    Sel extends Selection<OrganizationMemberUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationMemberUpdateInput
    }>,
    selectorFn: (s: OrganizationMemberUpdatePayload) => [...Sel],
  ): $Field<"organizationMemberUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationMemberUpdateInput!",
      },
      args,

      selection: selectorFn(new OrganizationMemberUpdatePayload()),
    }
    return this.$_select("organizationMemberUpdate", options as any) as any
  }

  /**
   * Specify the maximum timeframe to revoke organization access from inactive API tokens.
   */
  organizationRevokeInactiveTokensAfterUpdate<
    Args extends VariabledInput<{
      input: OrganizationRevokeInactiveTokensAfterUpdateMutationInput
    }>,
    Sel extends Selection<OrganizationRevokeInactiveTokensAfterUpdateMutationPayload>,
  >(
    args: ExactArgNames<Args, {
      input: OrganizationRevokeInactiveTokensAfterUpdateMutationInput
    }>,
    selectorFn: (s: OrganizationRevokeInactiveTokensAfterUpdateMutationPayload) => [...Sel],
  ): $Field<"organizationRevokeInactiveTokensAfterUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "OrganizationRevokeInactiveTokensAfterUpdateMutationInput!",
      },
      args,

      selection: selectorFn(new OrganizationRevokeInactiveTokensAfterUpdateMutationPayload()),
    }
    return this.$_select("organizationRevokeInactiveTokensAfterUpdate", options as any) as any
  }

  /**
   * Archive a pipeline.
   */
  pipelineArchive<
    Args extends VariabledInput<{
      input: PipelineArchiveInput
    }>,
    Sel extends Selection<PipelineArchivePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineArchiveInput
    }>,
    selectorFn: (s: PipelineArchivePayload) => [...Sel],
  ): $Field<"pipelineArchive", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineArchiveInput!",
      },
      args,

      selection: selectorFn(new PipelineArchivePayload()),
    }
    return this.$_select("pipelineArchive", options as any) as any
  }

  /**
   * Create a pipeline.
   */
  pipelineCreate<
    Args extends VariabledInput<{
      input: PipelineCreateInput
    }>,
    Sel extends Selection<PipelineCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineCreateInput
    }>,
    selectorFn: (s: PipelineCreatePayload) => [...Sel],
  ): $Field<"pipelineCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineCreateInput!",
      },
      args,

      selection: selectorFn(new PipelineCreatePayload()),
    }
    return this.$_select("pipelineCreate", options as any) as any
  }

  /**
   * Create SCM webhooks for a pipeline.
   */
  pipelineCreateWebhook<
    Args extends VariabledInput<{
      input: PipelineCreateWebhookInput
    }>,
    Sel extends Selection<PipelineCreateWebhookPayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineCreateWebhookInput
    }>,
    selectorFn: (s: PipelineCreateWebhookPayload) => [...Sel],
  ): $Field<"pipelineCreateWebhook", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineCreateWebhookInput!",
      },
      args,

      selection: selectorFn(new PipelineCreateWebhookPayload()),
    }
    return this.$_select("pipelineCreateWebhook", options as any) as any
  }

  /**
   * Delete a pipeline.
   */
  pipelineDelete<
    Args extends VariabledInput<{
      input: PipelineDeleteInput
    }>,
    Sel extends Selection<PipelineDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineDeleteInput
    }>,
    selectorFn: (s: PipelineDeletePayload) => [...Sel],
  ): $Field<"pipelineDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineDeleteInput!",
      },
      args,

      selection: selectorFn(new PipelineDeletePayload()),
    }
    return this.$_select("pipelineDelete", options as any) as any
  }

  /**
   * Favorite a pipeline.
   */
  pipelineFavorite<
    Args extends VariabledInput<{
      input: PipelineFavoriteInput
    }>,
    Sel extends Selection<PipelineFavoritePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineFavoriteInput
    }>,
    selectorFn: (s: PipelineFavoritePayload) => [...Sel],
  ): $Field<"pipelineFavorite", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineFavoriteInput!",
      },
      args,

      selection: selectorFn(new PipelineFavoritePayload()),
    }
    return this.$_select("pipelineFavorite", options as any) as any
  }

  /**
 * Rotate a pipeline's webhook URL.

Note that the old webhook URL will stop working immediately and so must be updated quickly to avoid interruption.

 */
  pipelineRotateWebhookURL<
    Args extends VariabledInput<{
      input: PipelineRotateWebhookURLInput
    }>,
    Sel extends Selection<PipelineRotateWebhookURLPayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineRotateWebhookURLInput
    }>,
    selectorFn: (s: PipelineRotateWebhookURLPayload) => [...Sel],
  ): $Field<"pipelineRotateWebhookURL", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineRotateWebhookURLInput!",
      },
      args,

      selection: selectorFn(new PipelineRotateWebhookURLPayload()),
    }
    return this.$_select("pipelineRotateWebhookURL", options as any) as any
  }

  /**
   * Create a scheduled build on pipeline.
   */
  pipelineScheduleCreate<
    Args extends VariabledInput<{
      input: PipelineScheduleCreateInput
    }>,
    Sel extends Selection<PipelineScheduleCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineScheduleCreateInput
    }>,
    selectorFn: (s: PipelineScheduleCreatePayload) => [...Sel],
  ): $Field<"pipelineScheduleCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineScheduleCreateInput!",
      },
      args,

      selection: selectorFn(new PipelineScheduleCreatePayload()),
    }
    return this.$_select("pipelineScheduleCreate", options as any) as any
  }

  /**
   * Delete a scheduled build on pipeline.
   */
  pipelineScheduleDelete<
    Args extends VariabledInput<{
      input: PipelineScheduleDeleteInput
    }>,
    Sel extends Selection<PipelineScheduleDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineScheduleDeleteInput
    }>,
    selectorFn: (s: PipelineScheduleDeletePayload) => [...Sel],
  ): $Field<"pipelineScheduleDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineScheduleDeleteInput!",
      },
      args,

      selection: selectorFn(new PipelineScheduleDeletePayload()),
    }
    return this.$_select("pipelineScheduleDelete", options as any) as any
  }

  /**
   * Update a scheduled build on pipeline.
   */
  pipelineScheduleUpdate<
    Args extends VariabledInput<{
      input: PipelineScheduleUpdateInput
    }>,
    Sel extends Selection<PipelineScheduleUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineScheduleUpdateInput
    }>,
    selectorFn: (s: PipelineScheduleUpdatePayload) => [...Sel],
  ): $Field<"pipelineScheduleUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineScheduleUpdateInput!",
      },
      args,

      selection: selectorFn(new PipelineScheduleUpdatePayload()),
    }
    return this.$_select("pipelineScheduleUpdate", options as any) as any
  }

  /**
   * Create a pipeline template.
   */
  pipelineTemplateCreate<
    Args extends VariabledInput<{
      input: PipelineTemplateCreateInput
    }>,
    Sel extends Selection<PipelineTemplateCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineTemplateCreateInput
    }>,
    selectorFn: (s: PipelineTemplateCreatePayload) => [...Sel],
  ): $Field<"pipelineTemplateCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineTemplateCreateInput!",
      },
      args,

      selection: selectorFn(new PipelineTemplateCreatePayload()),
    }
    return this.$_select("pipelineTemplateCreate", options as any) as any
  }

  /**
   * Delete a pipeline template.
   */
  pipelineTemplateDelete<
    Args extends VariabledInput<{
      input: PipelineTemplateDeleteInput
    }>,
    Sel extends Selection<PipelineTemplateDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineTemplateDeleteInput
    }>,
    selectorFn: (s: PipelineTemplateDeletePayload) => [...Sel],
  ): $Field<"pipelineTemplateDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineTemplateDeleteInput!",
      },
      args,

      selection: selectorFn(new PipelineTemplateDeletePayload()),
    }
    return this.$_select("pipelineTemplateDelete", options as any) as any
  }

  /**
   * Update a pipeline template.
   */
  pipelineTemplateUpdate<
    Args extends VariabledInput<{
      input: PipelineTemplateUpdateInput
    }>,
    Sel extends Selection<PipelineTemplateUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineTemplateUpdateInput
    }>,
    selectorFn: (s: PipelineTemplateUpdatePayload) => [...Sel],
  ): $Field<"pipelineTemplateUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineTemplateUpdateInput!",
      },
      args,

      selection: selectorFn(new PipelineTemplateUpdatePayload()),
    }
    return this.$_select("pipelineTemplateUpdate", options as any) as any
  }

  /**
   * Unarchive a pipeline.
   */
  pipelineUnarchive<
    Args extends VariabledInput<{
      input: PipelineUnarchiveInput
    }>,
    Sel extends Selection<PipelineUnarchivePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineUnarchiveInput
    }>,
    selectorFn: (s: PipelineUnarchivePayload) => [...Sel],
  ): $Field<"pipelineUnarchive", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineUnarchiveInput!",
      },
      args,

      selection: selectorFn(new PipelineUnarchivePayload()),
    }
    return this.$_select("pipelineUnarchive", options as any) as any
  }

  /**
   * Change the settings for a pipeline.
   */
  pipelineUpdate<
    Args extends VariabledInput<{
      input: PipelineUpdateInput
    }>,
    Sel extends Selection<PipelineUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: PipelineUpdateInput
    }>,
    selectorFn: (s: PipelineUpdatePayload) => [...Sel],
  ): $Field<"pipelineUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "PipelineUpdateInput!",
      },
      args,

      selection: selectorFn(new PipelineUpdatePayload()),
    }
    return this.$_select("pipelineUpdate", options as any) as any
  }

  /**
   * Create a rule.
   */
  ruleCreate<
    Args extends VariabledInput<{
      input: RuleCreateInput
    }>,
    Sel extends Selection<RuleCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: RuleCreateInput
    }>,
    selectorFn: (s: RuleCreatePayload) => [...Sel],
  ): $Field<"ruleCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "RuleCreateInput!",
      },
      args,

      selection: selectorFn(new RuleCreatePayload()),
    }
    return this.$_select("ruleCreate", options as any) as any
  }

  /**
   * Delete a rule.
   */
  ruleDelete<
    Args extends VariabledInput<{
      input: RuleDeleteInput
    }>,
    Sel extends Selection<RuleDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: RuleDeleteInput
    }>,
    selectorFn: (s: RuleDeletePayload) => [...Sel],
  ): $Field<"ruleDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "RuleDeleteInput!",
      },
      args,

      selection: selectorFn(new RuleDeletePayload()),
    }
    return this.$_select("ruleDelete", options as any) as any
  }

  /**
   * Update a rule.
   */
  ruleUpdate<
    Args extends VariabledInput<{
      input: RuleUpdateInput
    }>,
    Sel extends Selection<RuleUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: RuleUpdateInput
    }>,
    selectorFn: (s: RuleUpdatePayload) => [...Sel],
  ): $Field<"ruleUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "RuleUpdateInput!",
      },
      args,

      selection: selectorFn(new RuleUpdatePayload()),
    }
    return this.$_select("ruleUpdate", options as any) as any
  }

  /**
   * Create a SSO provider.
   */
  ssoProviderCreate<
    Args extends VariabledInput<{
      input: SSOProviderCreateInput
    }>,
    Sel extends Selection<SSOProviderCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: SSOProviderCreateInput
    }>,
    selectorFn: (s: SSOProviderCreatePayload) => [...Sel],
  ): $Field<"ssoProviderCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "SSOProviderCreateInput!",
      },
      args,

      selection: selectorFn(new SSOProviderCreatePayload()),
    }
    return this.$_select("ssoProviderCreate", options as any) as any
  }

  /**
   * Delete a SSO provider.
   */
  ssoProviderDelete<
    Args extends VariabledInput<{
      input: SSOProviderDeleteInput
    }>,
    Sel extends Selection<SSOProviderDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: SSOProviderDeleteInput
    }>,
    selectorFn: (s: SSOProviderDeletePayload) => [...Sel],
  ): $Field<"ssoProviderDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "SSOProviderDeleteInput!",
      },
      args,

      selection: selectorFn(new SSOProviderDeletePayload()),
    }
    return this.$_select("ssoProviderDelete", options as any) as any
  }

  /**
   * Disable a SSO provider.
   */
  ssoProviderDisable<
    Args extends VariabledInput<{
      input: SSOProviderDisableInput
    }>,
    Sel extends Selection<SSOProviderDisablePayload>,
  >(
    args: ExactArgNames<Args, {
      input: SSOProviderDisableInput
    }>,
    selectorFn: (s: SSOProviderDisablePayload) => [...Sel],
  ): $Field<"ssoProviderDisable", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "SSOProviderDisableInput!",
      },
      args,

      selection: selectorFn(new SSOProviderDisablePayload()),
    }
    return this.$_select("ssoProviderDisable", options as any) as any
  }

  /**
   * Enable a SSO provider.
   */
  ssoProviderEnable<
    Args extends VariabledInput<{
      input: SSOProviderEnableInput
    }>,
    Sel extends Selection<SSOProviderEnablePayload>,
  >(
    args: ExactArgNames<Args, {
      input: SSOProviderEnableInput
    }>,
    selectorFn: (s: SSOProviderEnablePayload) => [...Sel],
  ): $Field<"ssoProviderEnable", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "SSOProviderEnableInput!",
      },
      args,

      selection: selectorFn(new SSOProviderEnablePayload()),
    }
    return this.$_select("ssoProviderEnable", options as any) as any
  }

  /**
   * Change the settings for a SSO provider.
   */
  ssoProviderUpdate<
    Args extends VariabledInput<{
      input: SSOProviderUpdateInput
    }>,
    Sel extends Selection<SSOProviderUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: SSOProviderUpdateInput
    }>,
    selectorFn: (s: SSOProviderUpdatePayload) => [...Sel],
  ): $Field<"ssoProviderUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "SSOProviderUpdateInput!",
      },
      args,

      selection: selectorFn(new SSOProviderUpdatePayload()),
    }
    return this.$_select("ssoProviderUpdate", options as any) as any
  }

  /**
   * Create a team.
   */
  teamCreate<
    Args extends VariabledInput<{
      input: TeamCreateInput
    }>,
    Sel extends Selection<TeamCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamCreateInput
    }>,
    selectorFn: (s: TeamCreatePayload) => [...Sel],
  ): $Field<"teamCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamCreateInput!",
      },
      args,

      selection: selectorFn(new TeamCreatePayload()),
    }
    return this.$_select("teamCreate", options as any) as any
  }

  /**
   * Delete a team.
   */
  teamDelete<
    Args extends VariabledInput<{
      input: TeamDeleteInput
    }>,
    Sel extends Selection<TeamDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamDeleteInput
    }>,
    selectorFn: (s: TeamDeletePayload) => [...Sel],
  ): $Field<"teamDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamDeleteInput!",
      },
      args,

      selection: selectorFn(new TeamDeletePayload()),
    }
    return this.$_select("teamDelete", options as any) as any
  }

  /**
   * Add a user to a team.
   */
  teamMemberCreate<
    Args extends VariabledInput<{
      input: TeamMemberCreateInput
    }>,
    Sel extends Selection<TeamMemberCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamMemberCreateInput
    }>,
    selectorFn: (s: TeamMemberCreatePayload) => [...Sel],
  ): $Field<"teamMemberCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamMemberCreateInput!",
      },
      args,

      selection: selectorFn(new TeamMemberCreatePayload()),
    }
    return this.$_select("teamMemberCreate", options as any) as any
  }

  /**
   * Remove a user from a team.
   */
  teamMemberDelete<
    Args extends VariabledInput<{
      input: TeamMemberDeleteInput
    }>,
    Sel extends Selection<TeamMemberDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamMemberDeleteInput
    }>,
    selectorFn: (s: TeamMemberDeletePayload) => [...Sel],
  ): $Field<"teamMemberDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamMemberDeleteInput!",
      },
      args,

      selection: selectorFn(new TeamMemberDeletePayload()),
    }
    return this.$_select("teamMemberDelete", options as any) as any
  }

  /**
   * Update a user's role in a team.
   */
  teamMemberUpdate<
    Args extends VariabledInput<{
      input: TeamMemberUpdateInput
    }>,
    Sel extends Selection<TeamMemberUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamMemberUpdateInput
    }>,
    selectorFn: (s: TeamMemberUpdatePayload) => [...Sel],
  ): $Field<"teamMemberUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamMemberUpdateInput!",
      },
      args,

      selection: selectorFn(new TeamMemberUpdatePayload()),
    }
    return this.$_select("teamMemberUpdate", options as any) as any
  }

  /**
   * Add a pipeline to a team.
   */
  teamPipelineCreate<
    Args extends VariabledInput<{
      input: TeamPipelineCreateInput
    }>,
    Sel extends Selection<TeamPipelineCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamPipelineCreateInput
    }>,
    selectorFn: (s: TeamPipelineCreatePayload) => [...Sel],
  ): $Field<"teamPipelineCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamPipelineCreateInput!",
      },
      args,

      selection: selectorFn(new TeamPipelineCreatePayload()),
    }
    return this.$_select("teamPipelineCreate", options as any) as any
  }

  /**
   * Remove a pipeline from a team.
   */
  teamPipelineDelete<
    Args extends VariabledInput<{
      input: TeamPipelineDeleteInput
    }>,
    Sel extends Selection<TeamPipelineDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamPipelineDeleteInput
    }>,
    selectorFn: (s: TeamPipelineDeletePayload) => [...Sel],
  ): $Field<"teamPipelineDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamPipelineDeleteInput!",
      },
      args,

      selection: selectorFn(new TeamPipelineDeletePayload()),
    }
    return this.$_select("teamPipelineDelete", options as any) as any
  }

  /**
   * Update a pipeline's access level within a team.
   */
  teamPipelineUpdate<
    Args extends VariabledInput<{
      input: TeamPipelineUpdateInput
    }>,
    Sel extends Selection<TeamPipelineUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamPipelineUpdateInput
    }>,
    selectorFn: (s: TeamPipelineUpdatePayload) => [...Sel],
  ): $Field<"teamPipelineUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamPipelineUpdateInput!",
      },
      args,

      selection: selectorFn(new TeamPipelineUpdatePayload()),
    }
    return this.$_select("teamPipelineUpdate", options as any) as any
  }

  /**
   * Add a registry to a team.
   */
  teamRegistryCreate<
    Args extends VariabledInput<{
      input: TeamRegistryCreateInput
    }>,
    Sel extends Selection<TeamRegistryCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamRegistryCreateInput
    }>,
    selectorFn: (s: TeamRegistryCreatePayload) => [...Sel],
  ): $Field<"teamRegistryCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamRegistryCreateInput!",
      },
      args,

      selection: selectorFn(new TeamRegistryCreatePayload()),
    }
    return this.$_select("teamRegistryCreate", options as any) as any
  }

  /**
   * Remove a registry from a team.
   */
  teamRegistryDelete<
    Args extends VariabledInput<{
      input: TeamRegistryDeleteInput
    }>,
    Sel extends Selection<TeamRegistryDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamRegistryDeleteInput
    }>,
    selectorFn: (s: TeamRegistryDeletePayload) => [...Sel],
  ): $Field<"teamRegistryDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamRegistryDeleteInput!",
      },
      args,

      selection: selectorFn(new TeamRegistryDeletePayload()),
    }
    return this.$_select("teamRegistryDelete", options as any) as any
  }

  /**
   * Update a registry's access level within a team.
   */
  teamRegistryUpdate<
    Args extends VariabledInput<{
      input: TeamRegistryUpdateInput
    }>,
    Sel extends Selection<TeamRegistryUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamRegistryUpdateInput
    }>,
    selectorFn: (s: TeamRegistryUpdatePayload) => [...Sel],
  ): $Field<"teamRegistryUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamRegistryUpdateInput!",
      },
      args,

      selection: selectorFn(new TeamRegistryUpdatePayload()),
    }
    return this.$_select("teamRegistryUpdate", options as any) as any
  }

  /**
   * Add a suite to a team.
   */
  teamSuiteCreate<
    Args extends VariabledInput<{
      input: TeamSuiteCreateInput
    }>,
    Sel extends Selection<TeamSuiteCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamSuiteCreateInput
    }>,
    selectorFn: (s: TeamSuiteCreatePayload) => [...Sel],
  ): $Field<"teamSuiteCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamSuiteCreateInput!",
      },
      args,

      selection: selectorFn(new TeamSuiteCreatePayload()),
    }
    return this.$_select("teamSuiteCreate", options as any) as any
  }

  /**
   * Remove a suite from a team.
   */
  teamSuiteDelete<
    Args extends VariabledInput<{
      input: TeamSuiteDeleteInput
    }>,
    Sel extends Selection<TeamSuiteDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamSuiteDeleteInput
    }>,
    selectorFn: (s: TeamSuiteDeletePayload) => [...Sel],
  ): $Field<"teamSuiteDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamSuiteDeleteInput!",
      },
      args,

      selection: selectorFn(new TeamSuiteDeletePayload()),
    }
    return this.$_select("teamSuiteDelete", options as any) as any
  }

  /**
   * Update a suite's access level within a team.
   */
  teamSuiteUpdate<
    Args extends VariabledInput<{
      input: TeamSuiteUpdateInput
    }>,
    Sel extends Selection<TeamSuiteUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamSuiteUpdateInput
    }>,
    selectorFn: (s: TeamSuiteUpdatePayload) => [...Sel],
  ): $Field<"teamSuiteUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamSuiteUpdateInput!",
      },
      args,

      selection: selectorFn(new TeamSuiteUpdatePayload()),
    }
    return this.$_select("teamSuiteUpdate", options as any) as any
  }

  /**
   * Change the settings for a team.
   */
  teamUpdate<
    Args extends VariabledInput<{
      input: TeamUpdateInput
    }>,
    Sel extends Selection<TeamUpdatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TeamUpdateInput
    }>,
    selectorFn: (s: TeamUpdatePayload) => [...Sel],
  ): $Field<"teamUpdate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TeamUpdateInput!",
      },
      args,

      selection: selectorFn(new TeamUpdatePayload()),
    }
    return this.$_select("teamUpdate", options as any) as any
  }

  /**
 * Activate a previously-generated TOTP configuration, and its Recovery Codes.

Once activated, both this TOTP configuration, and the associated Recovery Codes will become active for the user.
Any previous TOTP configuration or Recovery Codes will no longer be usable.

This mutation is private, requires an escalated session, and cannot be accessed via the public GraphQL API.

 */
  totpActivate<
    Args extends VariabledInput<{
      input: TOTPActivateInput
    }>,
    Sel extends Selection<TOTPActivatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TOTPActivateInput
    }>,
    selectorFn: (s: TOTPActivatePayload) => [...Sel],
  ): $Field<"totpActivate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TOTPActivateInput!",
      },
      args,

      selection: selectorFn(new TOTPActivatePayload()),
    }
    return this.$_select("totpActivate", options as any) as any
  }

  /**
 * Create a new TOTP configuration for the current user.

This will produce a TOTP configuration with an associated set of Recovery Codes. The Recovery Codes must be presented to the user prior to the TOTP's activation with `totpActivate`.
Neither TOTP configuration nor Recovery Codes will be usable until they have been activated.

This mutation is private, requires an escalated session, and cannot be accessed via the public GraphQL API.

 */
  totpCreate<
    Args extends VariabledInput<{
      input: TOTPCreateInput
    }>,
    Sel extends Selection<TOTPCreatePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TOTPCreateInput
    }>,
    selectorFn: (s: TOTPCreatePayload) => [...Sel],
  ): $Field<"totpCreate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TOTPCreateInput!",
      },
      args,

      selection: selectorFn(new TOTPCreatePayload()),
    }
    return this.$_select("totpCreate", options as any) as any
  }

  /**
 * Delete a TOTP configuration.

If a TOTP configuration was active, it will no longer be used for logging on to the user's account.
Any Recovery Codes associated with the TOTP configuration will also no longer be usable.

This mutation is private, requires an escalated session, and cannot be accessed via the public GraphQL API.

 */
  totpDelete<
    Args extends VariabledInput<{
      input: TOTPDeleteInput
    }>,
    Sel extends Selection<TOTPDeletePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TOTPDeleteInput
    }>,
    selectorFn: (s: TOTPDeletePayload) => [...Sel],
  ): $Field<"totpDelete", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TOTPDeleteInput!",
      },
      args,

      selection: selectorFn(new TOTPDeletePayload()),
    }
    return this.$_select("totpDelete", options as any) as any
  }

  /**
 * Generate a new set of Recovery Codes for a given TOTP.

The new Recovery Codes will immediately replace any existing recovery codes.

This mutation is private, requires an escalated session, and cannot be accessed via the public GraphQL API.

 */
  totpRecoveryCodesRegenerate<
    Args extends VariabledInput<{
      input: TOTPRecoveryCodesRegenerateInput
    }>,
    Sel extends Selection<TOTPRecoveryCodesRegeneratePayload>,
  >(
    args: ExactArgNames<Args, {
      input: TOTPRecoveryCodesRegenerateInput
    }>,
    selectorFn: (s: TOTPRecoveryCodesRegeneratePayload) => [...Sel],
  ): $Field<"totpRecoveryCodesRegenerate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        input: "TOTPRecoveryCodesRegenerateInput!",
      },
      args,

      selection: selectorFn(new TOTPRecoveryCodesRegeneratePayload()),
    }
    return this.$_select("totpRecoveryCodesRegenerate", options as any) as any
  }
}

/**
 * An object with an ID.
 */
export class Node extends $Interface<
  {
    APIAccessToken: APIAccessToken
    APIAccessTokenCode: APIAccessTokenCode
    APIApplication: APIApplication
    Agent: Agent
    AgentToken: AgentToken
    Annotation: Annotation
    Artifact: Artifact
    AuditEvent: AuditEvent
    AuthorizationBitbucket: AuthorizationBitbucket
    AuthorizationGitHub: AuthorizationGitHub
    AuthorizationGitHubApp: AuthorizationGitHubApp
    AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise
    AuthorizationGoogle: AuthorizationGoogle
    AuthorizationSAML: AuthorizationSAML
    Build: Build
    Cluster: Cluster
    ClusterQueue: ClusterQueue
    ClusterQueueToken: ClusterQueueToken
    ClusterToken: ClusterToken
    CompositeRegistryUpstream: CompositeRegistryUpstream
    Email: Email
    JobEventAssigned: JobEventAssigned
    JobEventBuildStepUploadCreated: JobEventBuildStepUploadCreated
    JobEventCanceled: JobEventCanceled
    JobEventFinished: JobEventFinished
    JobEventGeneric: JobEventGeneric
    JobEventRetried: JobEventRetried
    JobEventRetryFailed: JobEventRetryFailed
    JobEventTimedOut: JobEventTimedOut
    JobTypeBlock: JobTypeBlock
    JobTypeCommand: JobTypeCommand
    JobTypeTrigger: JobTypeTrigger
    JobTypeWait: JobTypeWait
    NotificationServiceSlack: NotificationServiceSlack
    Organization: Organization
    OrganizationBanner: OrganizationBanner
    OrganizationInvitation: OrganizationInvitation
    OrganizationMember: OrganizationMember
    OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub
    OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer
    Pipeline: Pipeline
    PipelineMetric: PipelineMetric
    PipelineSchedule: PipelineSchedule
    PipelineTemplate: PipelineTemplate
    Registry: Registry
    RegistryToken: RegistryToken
    Rule: Rule
    SSOProviderGitHubApp: SSOProviderGitHubApp
    SSOProviderGoogleGSuite: SSOProviderGoogleGSuite
    SSOProviderSAML: SSOProviderSAML
    Secret: Secret
    Suite: Suite
    Team: Team
    TeamMember: TeamMember
    TeamPipeline: TeamPipeline
    TeamRegistry: TeamRegistry
    TeamSuite: TeamSuite
    User: User
    Viewer: Viewer
  },
  "Node"
> {
  constructor() {
    super({
      APIAccessToken: APIAccessToken,
      APIAccessTokenCode: APIAccessTokenCode,
      APIApplication: APIApplication,
      Agent: Agent,
      AgentToken: AgentToken,
      Annotation: Annotation,
      Artifact: Artifact,
      AuditEvent: AuditEvent,
      AuthorizationBitbucket: AuthorizationBitbucket,
      AuthorizationGitHub: AuthorizationGitHub,
      AuthorizationGitHubApp: AuthorizationGitHubApp,
      AuthorizationGitHubEnterprise: AuthorizationGitHubEnterprise,
      AuthorizationGoogle: AuthorizationGoogle,
      AuthorizationSAML: AuthorizationSAML,
      Build: Build,
      Cluster: Cluster,
      ClusterQueue: ClusterQueue,
      ClusterQueueToken: ClusterQueueToken,
      ClusterToken: ClusterToken,
      CompositeRegistryUpstream: CompositeRegistryUpstream,
      Email: Email,
      JobEventAssigned: JobEventAssigned,
      JobEventBuildStepUploadCreated: JobEventBuildStepUploadCreated,
      JobEventCanceled: JobEventCanceled,
      JobEventFinished: JobEventFinished,
      JobEventGeneric: JobEventGeneric,
      JobEventRetried: JobEventRetried,
      JobEventRetryFailed: JobEventRetryFailed,
      JobEventTimedOut: JobEventTimedOut,
      JobTypeBlock: JobTypeBlock,
      JobTypeCommand: JobTypeCommand,
      JobTypeTrigger: JobTypeTrigger,
      JobTypeWait: JobTypeWait,
      NotificationServiceSlack: NotificationServiceSlack,
      Organization: Organization,
      OrganizationBanner: OrganizationBanner,
      OrganizationInvitation: OrganizationInvitation,
      OrganizationMember: OrganizationMember,
      OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub,
      OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer,
      Pipeline: Pipeline,
      PipelineMetric: PipelineMetric,
      PipelineSchedule: PipelineSchedule,
      PipelineTemplate: PipelineTemplate,
      Registry: Registry,
      RegistryToken: RegistryToken,
      Rule: Rule,
      SSOProviderGitHubApp: SSOProviderGitHubApp,
      SSOProviderGoogleGSuite: SSOProviderGoogleGSuite,
      SSOProviderSAML: SSOProviderSAML,
      Secret: Secret,
      Suite: Suite,
      Team: Team,
      TeamMember: TeamMember,
      TeamPipeline: TeamPipeline,
      TeamRegistry: TeamRegistry,
      TeamSuite: TeamSuite,
      User: User,
      Viewer: Viewer,
    }, "Node")
  }

  /**
   * ID of the object.
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A notice or notice that a user sees in the Buildkite UI
 */
export class Notice extends $Base<"Notice"> {
  constructor() {
    super("Notice")
  }

  /**
   * The time when this notice was dismissed from the UI
   */
  get dismissedAt(): $Field<"dismissedAt", CustomScalar<DateTime> | null> {
    return this.$_select("dismissedAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The namespace of this notice
   */
  get namespace(): $Field<"namespace", NoticeNamespaces> {
    return this.$_select("namespace") as any
  }

  /**
   * The scope within the namespace
   */
  get scope(): $Field<"scope", string> {
    return this.$_select("scope") as any
  }
}

/**
 * Autogenerated input type of NoticeDismiss
 */
export type NoticeDismissInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of NoticeDismiss.
 */
export class NoticeDismissPayload extends $Base<"NoticeDismissPayload"> {
  constructor() {
    super("NoticeDismissPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  notice<Sel extends Selection<Notice>>(
    selectorFn: (s: Notice) => [...Sel],
  ): $Field<"notice", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Notice()),
    }
    return this.$_select("notice", options as any) as any
  }
}

/**
 * All the possible namespaces for a notice
 */
export enum NoticeNamespaces {
  /**
   * A change to an existing feature
   */
  CHANGE = "CHANGE",

  /**
   * The user has had an email suggested to them
   */
  EMAIL_SUGGESTION = "EMAIL_SUGGESTION",

  /**
   * A new feature was added
   */
  FEATURE = "FEATURE",

  /**
   * An event announcement
   */
  EVENT = "EVENT",
}

export class NotificationService extends $Interface<
  {
    NotificationServiceOpenTelemetryTracing: NotificationServiceOpenTelemetryTracing
    NotificationServiceSlack: NotificationServiceSlack
    NotificationServiceWebhook: NotificationServiceWebhook
  },
  "NotificationService"
> {
  constructor() {
    super({
      NotificationServiceOpenTelemetryTracing: NotificationServiceOpenTelemetryTracing,
      NotificationServiceSlack: NotificationServiceSlack,
      NotificationServiceWebhook: NotificationServiceWebhook,
    }, "NotificationService")
  }

  /**
   * The description of this service
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the service provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * Deliver OpenTelemetry Traces to a custom OTLP endpoint
 */
export class NotificationServiceOpenTelemetryTracing extends $Base<"NotificationServiceOpenTelemetryTracing"> {
  constructor() {
    super("NotificationServiceOpenTelemetryTracing")
  }

  /**
   * The description of this service
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the service provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * Deliver notifications to Slack
 */
export class NotificationServiceSlack extends $Base<"NotificationServiceSlack"> {
  constructor() {
    super("NotificationServiceSlack")
  }

  /**
   * The description of this service
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the service provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * Deliver notifications to a custom URL
 */
export class NotificationServiceWebhook extends $Base<"NotificationServiceWebhook"> {
  constructor() {
    super("NotificationServiceWebhook")
  }

  /**
   * The description of this service
   */
  get description(): $Field<"description", string> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the service provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * A operating system that an agent can run on
 */
export class OperatingSystem extends $Base<"OperatingSystem"> {
  constructor() {
    super("OperatingSystem")
  }

  /**
   * The name of the operating system
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * An organization
 */
export class Organization extends $Base<"Organization"> {
  constructor() {
    super("Organization")
  }

  /**
   * Returns agent access tokens for an Organization. By default returns all tokens, whether revoked or non-revoked.
   */
  agentTokens<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
      revoked?: boolean | null
    }>,
    Sel extends Selection<AgentTokenConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
      revoked?: boolean | null
    }>,
    selectorFn: (s: AgentTokenConnection) => [...Sel],
  ): $Field<"agentTokens", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  agentTokens<Sel extends Selection<AgentTokenConnection>>(
    selectorFn: (s: AgentTokenConnection) => [...Sel],
  ): $Field<"agentTokens", GetOutput<Sel> | null, GetVariables<Sel>>
  agentTokens(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
        revoked: "Boolean",
      },
      args,

      selection: selectorFn(new AgentTokenConnection()),
    }
    return this.$_select("agentTokens", options as any) as any
  }

  agents<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      metaData?: Readonly<Array<string>> | null
      cluster?: string | null
      clusterQueue?: Readonly<Array<string>> | null
      clustered?: boolean | null
      isRunningJob?: boolean | null
      paused?: boolean | null
    }>,
    Sel extends Selection<AgentConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      metaData?: Readonly<Array<string>> | null
      cluster?: string | null
      clusterQueue?: Readonly<Array<string>> | null
      clustered?: boolean | null
      isRunningJob?: boolean | null
      paused?: boolean | null
    }>,
    selectorFn: (s: AgentConnection) => [...Sel],
  ): $Field<"agents", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  agents<Sel extends Selection<AgentConnection>>(
    selectorFn: (s: AgentConnection) => [...Sel],
  ): $Field<"agents", GetOutput<Sel> | null, GetVariables<Sel>>
  agents(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        metaData: "[String!]",
        cluster: "ID",
        clusterQueue: "[ID!]",
        clustered: "Boolean",
        isRunningJob: "Boolean",
        paused: "Boolean",
      },
      args,

      selection: selectorFn(new AgentConnection()),
    }
    return this.$_select("agents", options as any) as any
  }

  /**
   * A space-separated allowlist of IP addresses that can access the organization via the GraphQL or REST API
   */
  get allowedApiIpAddresses(): $Field<"allowedApiIpAddresses", string | null> {
    return this.$_select("allowedApiIpAddresses") as any
  }

  /**
   * Returns user API access tokens that can access this organization
   */
  apiAccessTokens<
    Args extends VariabledInput<{
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<OrganizationAPIAccessTokenConnection>,
  >(
    args: ExactArgNames<Args, {
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: OrganizationAPIAccessTokenConnection) => [...Sel],
  ): $Field<"apiAccessTokens", GetOutput<Sel>, GetVariables<Sel, Args>>
  apiAccessTokens<Sel extends Selection<OrganizationAPIAccessTokenConnection>>(
    selectorFn: (s: OrganizationAPIAccessTokenConnection) => [...Sel],
  ): $Field<"apiAccessTokens", GetOutput<Sel>, GetVariables<Sel>>
  apiAccessTokens(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        after: "String",
        before: "String",
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new OrganizationAPIAccessTokenConnection()),
    }
    return this.$_select("apiAccessTokens", options as any) as any
  }

  auditEvents<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      occurredAtFrom?: CustomScalar<DateTime> | null
      occurredAtTo?: CustomScalar<DateTime> | null
      type?: Readonly<Array<AuditEventType>> | null
      actorType?: Readonly<Array<AuditActorType>> | null
      actor?: Readonly<Array<string>> | null
      subjectType?: Readonly<Array<AuditSubjectType>> | null
      subject?: Readonly<Array<string>> | null
      order?: OrganizationAuditEventOrders | null
      subjectUUID?: Readonly<Array<string>> | null
    }>,
    Sel extends Selection<OrganizationAuditEventConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      occurredAtFrom?: CustomScalar<DateTime> | null
      occurredAtTo?: CustomScalar<DateTime> | null
      type?: Readonly<Array<AuditEventType>> | null
      actorType?: Readonly<Array<AuditActorType>> | null
      actor?: Readonly<Array<string>> | null
      subjectType?: Readonly<Array<AuditSubjectType>> | null
      subject?: Readonly<Array<string>> | null
      order?: OrganizationAuditEventOrders | null
      subjectUUID?: Readonly<Array<string>> | null
    }>,
    selectorFn: (s: OrganizationAuditEventConnection) => [...Sel],
  ): $Field<"auditEvents", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  auditEvents<Sel extends Selection<OrganizationAuditEventConnection>>(
    selectorFn: (s: OrganizationAuditEventConnection) => [...Sel],
  ): $Field<"auditEvents", GetOutput<Sel> | null, GetVariables<Sel>>
  auditEvents(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        occurredAtFrom: "DateTime",
        occurredAtTo: "DateTime",
        type: "[AuditEventType!]",
        actorType: "[AuditActorType!]",
        actor: "[ID!]",
        subjectType: "[AuditSubjectType!]",
        subject: "[ID!]",
        order: "OrganizationAuditEventOrders",
        subjectUUID: "[ID!]",
      },
      args,

      selection: selectorFn(new OrganizationAuditEventConnection()),
    }
    return this.$_select("auditEvents", options as any) as any
  }

  /**
   * Returns active banners for this organization.
   */
  banners<
    Args extends VariabledInput<{
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<OrganizationBannerConnection>,
  >(
    args: ExactArgNames<Args, {
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: OrganizationBannerConnection) => [...Sel],
  ): $Field<"banners", GetOutput<Sel>, GetVariables<Sel, Args>>
  banners<Sel extends Selection<OrganizationBannerConnection>>(
    selectorFn: (s: OrganizationBannerConnection) => [...Sel],
  ): $Field<"banners", GetOutput<Sel>, GetVariables<Sel>>
  banners(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        after: "String",
        before: "String",
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new OrganizationBannerConnection()),
    }
    return this.$_select("banners", options as any) as any
  }

  /**
   * Return cluster in the Organization by UUID
   */
  cluster<
    Args extends VariabledInput<{
      id: string
    }>,
    Sel extends Selection<Cluster>,
  >(
    args: ExactArgNames<Args, {
      id: string
    }>,
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        id: "ID!",
      },
      args,

      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  /**
   * Returns clusters for an Organization
   */
  clusters<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: ClusterOrder | null
    }>,
    Sel extends Selection<ClusterConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: ClusterOrder | null
    }>,
    selectorFn: (s: ClusterConnection) => [...Sel],
  ): $Field<"clusters", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  clusters<Sel extends Selection<ClusterConnection>>(
    selectorFn: (s: ClusterConnection) => [...Sel],
  ): $Field<"clusters", GetOutput<Sel> | null, GetVariables<Sel>>
  clusters(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "ClusterOrder",
      },
      args,

      selection: selectorFn(new ClusterConnection()),
    }
    return this.$_select("clusters", options as any) as any
  }

  /**
   * The URL to an icon representing this organization
   */
  get iconUrl(): $Field<"iconUrl", string | null> {
    return this.$_select("iconUrl") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  invitations<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<OrganizationInvitationStates>> | null
      order?: OrganizationInvitationOrders | null
    }>,
    Sel extends Selection<OrganizationInvitationConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<OrganizationInvitationStates>> | null
      order?: OrganizationInvitationOrders | null
    }>,
    selectorFn: (s: OrganizationInvitationConnection) => [...Sel],
  ): $Field<"invitations", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  invitations<Sel extends Selection<OrganizationInvitationConnection>>(
    selectorFn: (s: OrganizationInvitationConnection) => [...Sel],
  ): $Field<"invitations", GetOutput<Sel> | null, GetVariables<Sel>>
  invitations(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        state: "[OrganizationInvitationStates!]",
        order: "OrganizationInvitationOrders",
      },
      args,

      selection: selectorFn(new OrganizationInvitationConnection()),
    }
    return this.$_select("invitations", options as any) as any
  }

  /**
   * Whether teams is enabled for this organization
   */
  get isTeamsEnabled(): $Field<"isTeamsEnabled", boolean> {
    return this.$_select("isTeamsEnabled") as any
  }

  jobs<
    Args extends VariabledInput<{
      finishedAt?: CustomScalar<DateTime> | null
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
      cluster?: string | null
      clusterQueue?: Readonly<Array<string>> | null
      clustered?: boolean | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<JobConnection>,
  >(
    args: ExactArgNames<Args, {
      finishedAt?: CustomScalar<DateTime> | null
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
      cluster?: string | null
      clusterQueue?: Readonly<Array<string>> | null
      clustered?: boolean | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  jobs<Sel extends Selection<JobConnection>>(
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel>>
  jobs(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        finishedAt: "DateTime",
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        type: "[JobTypes!]",
        state: "[JobStates!]",
        priority: "JobPrioritySearch",
        agentQueryRules: "[String!]",
        concurrency: "JobConcurrencySearch",
        passed: "Boolean",
        step: "JobStepSearch",
        order: "JobOrder",
        cluster: "ID",
        clusterQueue: "[ID!]",
        clustered: "Boolean",
        createdAtFrom: "DateTime",
        createdAtTo: "DateTime",
      },
      args,

      selection: selectorFn(new JobConnection()),
    }
    return this.$_select("jobs", options as any) as any
  }

  /**
   * Returns users within the organization
   */
  members<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      email?: string | null
      team?: CustomScalar<TeamSelector> | null
      role?: Readonly<Array<OrganizationMemberRole>> | null
      security?: OrganizationMemberSecurityInput | null
      sso?: OrganizationMemberSSOInput | null
      order?: OrganizationMemberOrder | null
      inactiveSince?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<OrganizationMemberConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      email?: string | null
      team?: CustomScalar<TeamSelector> | null
      role?: Readonly<Array<OrganizationMemberRole>> | null
      security?: OrganizationMemberSecurityInput | null
      sso?: OrganizationMemberSSOInput | null
      order?: OrganizationMemberOrder | null
      inactiveSince?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: OrganizationMemberConnection) => [...Sel],
  ): $Field<"members", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  members<Sel extends Selection<OrganizationMemberConnection>>(
    selectorFn: (s: OrganizationMemberConnection) => [...Sel],
  ): $Field<"members", GetOutput<Sel> | null, GetVariables<Sel>>
  members(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        email: "String",
        team: "TeamSelector",
        role: "[OrganizationMemberRole!]",
        security: "OrganizationMemberSecurityInput",
        sso: "OrganizationMemberSSOInput",
        order: "OrganizationMemberOrder",
        inactiveSince: "DateTime",
      },
      args,

      selection: selectorFn(new OrganizationMemberConnection()),
    }
    return this.$_select("members", options as any) as any
  }

  /**
   * Whether this organization requires 2FA to access (Please note that this is a beta feature and is not yet available to all organizations.)
   */
  get membersRequireTwoFactorAuthentication(): $Field<"membersRequireTwoFactorAuthentication", boolean> {
    return this.$_select("membersRequireTwoFactorAuthentication") as any
  }

  /**
   * The name of the organization
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  permissions<Sel extends Selection<OrganizationPermissions>>(
    selectorFn: (s: OrganizationPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * Return all the pipeline templates the current user has access to for this organization
   */
  pipelineTemplates<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
      after?: string | null
      before?: string | null
      order?: PipelineTemplateOrder | null
    }>,
    Sel extends Selection<PipelineTemplateConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
      after?: string | null
      before?: string | null
      order?: PipelineTemplateOrder | null
    }>,
    selectorFn: (s: PipelineTemplateConnection) => [...Sel],
  ): $Field<"pipelineTemplates", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  pipelineTemplates<Sel extends Selection<PipelineTemplateConnection>>(
    selectorFn: (s: PipelineTemplateConnection) => [...Sel],
  ): $Field<"pipelineTemplates", GetOutput<Sel> | null, GetVariables<Sel>>
  pipelineTemplates(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
        after: "String",
        before: "String",
        order: "PipelineTemplateOrder",
      },
      args,

      selection: selectorFn(new PipelineTemplateConnection()),
    }
    return this.$_select("pipelineTemplates", options as any) as any
  }

  /**
   * Return all the pipelines the current user has access to for this organization
   */
  pipelines<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      repository?: PipelineRepositoryInput | null
      cluster?: string | null
      clustered?: boolean | null
      archived?: boolean | null
      team?: CustomScalar<TeamSelector> | null
      favorite?: boolean | null
      order?: PipelineOrders | null
      tags?: Readonly<Array<string>> | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<PipelineConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      repository?: PipelineRepositoryInput | null
      cluster?: string | null
      clustered?: boolean | null
      archived?: boolean | null
      team?: CustomScalar<TeamSelector> | null
      favorite?: boolean | null
      order?: PipelineOrders | null
      tags?: Readonly<Array<string>> | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: PipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  pipelines<Sel extends Selection<PipelineConnection>>(
    selectorFn: (s: PipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel> | null, GetVariables<Sel>>
  pipelines(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        repository: "PipelineRepositoryInput",
        cluster: "ID",
        clustered: "Boolean",
        archived: "Boolean",
        team: "TeamSelector",
        favorite: "Boolean",
        order: "PipelineOrders",
        tags: "[String!]",
        createdAtFrom: "DateTime",
        createdAtTo: "DateTime",
      },
      args,

      selection: selectorFn(new PipelineConnection()),
    }
    return this.$_select("pipelines", options as any) as any
  }

  /**
   * Whether this organization is visible to everyone, including people outside it
   */
  get public(): $Field<"public", boolean> {
    return this.$_select("public") as any
  }

  /**
   * Return all the registries the current user has access to for this organization
   */
  registries<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      team?: CustomScalar<TeamSelector> | null
      order?: RegistryOrders | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<RegistryConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      team?: CustomScalar<TeamSelector> | null
      order?: RegistryOrders | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: RegistryConnection) => [...Sel],
  ): $Field<"registries", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  registries<Sel extends Selection<RegistryConnection>>(
    selectorFn: (s: RegistryConnection) => [...Sel],
  ): $Field<"registries", GetOutput<Sel> | null, GetVariables<Sel>>
  registries(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        team: "TeamSelector",
        order: "RegistryOrders",
        createdAtFrom: "DateTime",
        createdAtTo: "DateTime",
      },
      args,

      selection: selectorFn(new RegistryConnection()),
    }
    return this.$_select("registries", options as any) as any
  }

  /**
   * Returns the repository providers for this organization
   */
  repositoryProviders<Sel extends Selection<OrganizationRepositoryProvider>>(
    selectorFn: (s: OrganizationRepositoryProvider) => [...Sel],
  ): $Field<"repositoryProviders", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationRepositoryProvider()),
    }
    return this.$_select("repositoryProviders", options as any) as any
  }

  /**
   * API tokens with access to this organization will be automatically revoked after this many seconds of inactivity. A `null` value indicates never revoke inactive tokens.
   */
  get revokeInactiveTokensAfter(): $Field<"revokeInactiveTokensAfter", RevokeInactiveTokenPeriod | null> {
    return this.$_select("revokeInactiveTokensAfter") as any
  }

  /**
   * Returns rules for an Organization
   */
  rules<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: RuleOrder | null
      sourceType?: Readonly<Array<RuleSourceType>> | null
      targetType?: Readonly<Array<RuleTargetType>> | null
      action?: Readonly<Array<RuleAction>> | null
    }>,
    Sel extends Selection<RuleConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: RuleOrder | null
      sourceType?: Readonly<Array<RuleSourceType>> | null
      targetType?: Readonly<Array<RuleTargetType>> | null
      action?: Readonly<Array<RuleAction>> | null
    }>,
    selectorFn: (s: RuleConnection) => [...Sel],
  ): $Field<"rules", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  rules<Sel extends Selection<RuleConnection>>(
    selectorFn: (s: RuleConnection) => [...Sel],
  ): $Field<"rules", GetOutput<Sel> | null, GetVariables<Sel>>
  rules(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "RuleOrder",
        sourceType: "[RuleSourceType!]",
        targetType: "[RuleTargetType!]",
        action: "[RuleAction!]",
      },
      args,

      selection: selectorFn(new RuleConnection()),
    }
    return this.$_select("rules", options as any) as any
  }

  /**
   * The slug used to represent the organization in URLs
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  /**
   * The single sign-on configuration of this organization
   */
  sso<Sel extends Selection<OrganizationSSO>>(
    selectorFn: (s: OrganizationSSO) => [...Sel],
  ): $Field<"sso", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationSSO()),
    }
    return this.$_select("sso", options as any) as any
  }

  /**
   * Single sign on providers created for an organization
   */
  ssoProviders<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<SSOProviderConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: SSOProviderConnection) => [...Sel],
  ): $Field<"ssoProviders", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  ssoProviders<Sel extends Selection<SSOProviderConnection>>(
    selectorFn: (s: SSOProviderConnection) => [...Sel],
  ): $Field<"ssoProviders", GetOutput<Sel> | null, GetVariables<Sel>>
  ssoProviders(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new SSOProviderConnection()),
    }
    return this.$_select("ssoProviders", options as any) as any
  }

  /**
   * Return all the suite the current user has access to for this organization
   */
  suites<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      team?: CustomScalar<TeamSelector> | null
      order?: SuiteOrders | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<SuiteConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      team?: CustomScalar<TeamSelector> | null
      order?: SuiteOrders | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: SuiteConnection) => [...Sel],
  ): $Field<"suites", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  suites<Sel extends Selection<SuiteConnection>>(
    selectorFn: (s: SuiteConnection) => [...Sel],
  ): $Field<"suites", GetOutput<Sel> | null, GetVariables<Sel>>
  suites(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        team: "TeamSelector",
        order: "SuiteOrders",
        createdAtFrom: "DateTime",
        createdAtTo: "DateTime",
      },
      args,

      selection: selectorFn(new SuiteConnection()),
    }
    return this.$_select("suites", options as any) as any
  }

  /**
   * Returns teams within the organization that the viewer can see
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      pipeline?: CustomScalar<PipelineSelector> | null
      user?: CustomScalar<UserSelector> | null
      privacy?: Readonly<Array<TeamPrivacy>> | null
      order?: TeamOrder | null
    }>,
    Sel extends Selection<TeamConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      pipeline?: CustomScalar<PipelineSelector> | null
      user?: CustomScalar<UserSelector> | null
      privacy?: Readonly<Array<TeamPrivacy>> | null
      order?: TeamOrder | null
    }>,
    selectorFn: (s: TeamConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  teams<Sel extends Selection<TeamConnection>>(
    selectorFn: (s: TeamConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        pipeline: "PipelineSelector",
        user: "UserSelector",
        privacy: "[TeamPrivacy!]",
        order: "TeamOrder",
      },
      args,

      selection: selectorFn(new TeamConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  /**
   * The public UUID for this organization
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Information on user API Access Tokens which can access the Organization. Excludes the token attribute
 */
export class OrganizationAPIAccessToken extends $Base<"OrganizationAPIAccessToken"> {
  constructor() {
    super("OrganizationAPIAccessToken")
  }

  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * A description of the token
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The IP address of the last request to the Buildkite API
   */
  get ipAddress(): $Field<"ipAddress", string | null> {
    return this.$_select("ipAddress") as any
  }

  /**
   * The last time the token was used to access the Buildkite API
   */
  get lastAccessedAt(): $Field<"lastAccessedAt", CustomScalar<DateTime> | null> {
    return this.$_select("lastAccessedAt") as any
  }

  /**
   * The user associated with this token
   */
  owner<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"owner", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("owner", options as any) as any
  }

  /**
   * The organization scopes that the user's token has access to
   */
  get scopes(): $Field<"scopes", Readonly<Array<APIAccessTokenScopes>>> {
    return this.$_select("scopes") as any
  }

  /**
   * The public UUID for the API Access Token
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The connection type for OrganizationAPIAccessToken.
 */
export class OrganizationAPIAccessTokenConnection extends $Base<"OrganizationAPIAccessTokenConnection"> {
  constructor() {
    super("OrganizationAPIAccessTokenConnection")
  }

  /**
   * A list of edges.
   */
  edges<Sel extends Selection<OrganizationAPIAccessTokenEdge>>(
    selectorFn: (s: OrganizationAPIAccessTokenEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationAPIAccessTokenEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  /**
   * A list of nodes.
   */
  nodes<Sel extends Selection<OrganizationAPIAccessToken>>(
    selectorFn: (s: OrganizationAPIAccessToken) => [...Sel],
  ): $Field<"nodes", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationAPIAccessToken()),
    }
    return this.$_select("nodes", options as any) as any
  }

  /**
   * Information to aid in pagination.
   */
  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * An edge in a connection.
 */
export class OrganizationAPIAccessTokenEdge extends $Base<"OrganizationAPIAccessTokenEdge"> {
  constructor() {
    super("OrganizationAPIAccessTokenEdge")
  }

  /**
   * A cursor for use in pagination.
   */
  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  /**
   * The item at the end of the edge.
   */
  node<Sel extends Selection<OrganizationAPIAccessToken>>(
    selectorFn: (s: OrganizationAPIAccessToken) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationAPIAccessToken()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationAPIAccessTokenRevokeMutation
 */
export type OrganizationAPIAccessTokenRevokeMutationInput = {
  apiAccessTokenId: string
  clientMutationId?: string | null
  organizationId: string
}

/**
 * Autogenerated return type of OrganizationAPIAccessTokenRevokeMutation.
 */
export class OrganizationAPIAccessTokenRevokeMutationPayload
  extends $Base<"OrganizationAPIAccessTokenRevokeMutationPayload"> {
  constructor() {
    super("OrganizationAPIAccessTokenRevokeMutationPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get revokedApiAccessTokenId(): $Field<"revokedApiAccessTokenId", string> {
    return this.$_select("revokedApiAccessTokenId") as any
  }
}

/**
 * Autogenerated input type of OrganizationAPIIPAllowlistUpdateMutation
 */
export type OrganizationAPIIPAllowlistUpdateMutationInput = {
  clientMutationId?: string | null
  ipAddresses: string
  organizationID: string
}

/**
 * Autogenerated return type of OrganizationAPIIPAllowlistUpdateMutation.
 */
export class OrganizationAPIIPAllowlistUpdateMutationPayload
  extends $Base<"OrganizationAPIIPAllowlistUpdateMutationPayload"> {
  constructor() {
    super("OrganizationAPIIPAllowlistUpdateMutationPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

export class OrganizationAuditEventConnection extends $Base<"OrganizationAuditEventConnection"> {
  constructor() {
    super("OrganizationAuditEventConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationAuditEventEdge>>(
    selectorFn: (s: OrganizationAuditEventEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationAuditEventEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class OrganizationAuditEventEdge extends $Base<"OrganizationAuditEventEdge"> {
  constructor() {
    super("OrganizationAuditEventEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<AuditEvent>>(
    selectorFn: (s: AuditEvent) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new AuditEvent()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort audit events by
 */
export enum OrganizationAuditEventOrders {
  /**
   * Order by the most recently occurring events first
   */
  RECENTLY_OCCURRED = "RECENTLY_OCCURRED",
}

/**
 * System banner of an organization
 */
export class OrganizationBanner extends $Base<"OrganizationBanner"> {
  constructor() {
    super("OrganizationBanner")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The banner message
   */
  get message(): $Field<"message", string> {
    return this.$_select("message") as any
  }

  /**
   * The UUID of the organization banner
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The connection type for OrganizationBanner.
 */
export class OrganizationBannerConnection extends $Base<"OrganizationBannerConnection"> {
  constructor() {
    super("OrganizationBannerConnection")
  }

  /**
   * A list of edges.
   */
  edges<Sel extends Selection<OrganizationBannerEdge>>(
    selectorFn: (s: OrganizationBannerEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationBannerEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  /**
   * A list of nodes.
   */
  nodes<Sel extends Selection<OrganizationBanner>>(
    selectorFn: (s: OrganizationBanner) => [...Sel],
  ): $Field<"nodes", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationBanner()),
    }
    return this.$_select("nodes", options as any) as any
  }

  /**
   * Information to aid in pagination.
   */
  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationBannerDelete
 */
export type OrganizationBannerDeleteInput = {
  clientMutationId?: string | null
  organizationId: string
}

/**
 * Autogenerated return type of OrganizationBannerDelete.
 */
export class OrganizationBannerDeletePayload extends $Base<"OrganizationBannerDeletePayload"> {
  constructor() {
    super("OrganizationBannerDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedBannerId(): $Field<"deletedBannerId", string> {
    return this.$_select("deletedBannerId") as any
  }
}

/**
 * An edge in a connection.
 */
export class OrganizationBannerEdge extends $Base<"OrganizationBannerEdge"> {
  constructor() {
    super("OrganizationBannerEdge")
  }

  /**
   * A cursor for use in pagination.
   */
  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  /**
   * The item at the end of the edge.
   */
  node<Sel extends Selection<OrganizationBanner>>(
    selectorFn: (s: OrganizationBanner) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationBanner()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationBannerUpsert
 */
export type OrganizationBannerUpsertInput = {
  clientMutationId?: string | null
  message: string
  organizationId: string
}

/**
 * Autogenerated return type of OrganizationBannerUpsert.
 */
export class OrganizationBannerUpsertPayload extends $Base<"OrganizationBannerUpsertPayload"> {
  constructor() {
    super("OrganizationBannerUpsertPayload")
  }

  banner<Sel extends Selection<OrganizationBanner>>(
    selectorFn: (s: OrganizationBanner) => [...Sel],
  ): $Field<"banner", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationBanner()),
    }
    return this.$_select("banner", options as any) as any
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }
}

export class OrganizationConnection extends $Base<"OrganizationConnection"> {
  constructor() {
    super("OrganizationConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationEdge>>(
    selectorFn: (s: OrganizationEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class OrganizationEdge extends $Base<"OrganizationEdge"> {
  constructor() {
    super("OrganizationEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutation
 */
export type OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationInput = {
  clientMutationId?: string | null
  membersRequireTwoFactorAuthentication: boolean
  organizationId: string
}

/**
 * Autogenerated return type of OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutation.
 */
export class OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload
  extends $Base<"OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload"> {
  constructor() {
    super("OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

/**
 * A request made by Buildkite to impersonate a user in an organization
 */
export class OrganizationImpersonationRequest extends $Base<"OrganizationImpersonationRequest"> {
  constructor() {
    super("OrganizationImpersonationRequest")
  }

  get approvedAt(): $Field<"approvedAt", CustomScalar<DateTime> | null> {
    return this.$_select("approvedAt") as any
  }

  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  get duration(): $Field<"duration", string | null> {
    return this.$_select("duration") as any
  }

  get reason(): $Field<"reason", string | null> {
    return this.$_select("reason") as any
  }

  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A pending invitation to a user to join this organization
 */
export class OrganizationInvitation extends $Base<"OrganizationInvitation"> {
  constructor() {
    super("OrganizationInvitation")
  }

  /**
   * The time when the invitation was accepted
   */
  get acceptedAt(): $Field<"acceptedAt", CustomScalar<DateTime> | null> {
    return this.$_select("acceptedAt") as any
  }

  /**
   * The user that accepted this invite
   */
  acceptedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"acceptedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("acceptedBy", options as any) as any
  }

  /**
   * The time when the invitation was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added invited this email address
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The email address of this invitation
   */
  get email(): $Field<"email", string> {
    return this.$_select("email") as any
  }

  /**
   * The time when the invitation was automatically expired
   */
  get expiredAt(): $Field<"expiredAt", CustomScalar<DateTime> | null> {
    return this.$_select("expiredAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  permissions<Sel extends Selection<OrganizationInvitationPermissions>>(
    selectorFn: (s: OrganizationInvitationPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The time when this invitation was revoked
   */
  get revokedAt(): $Field<"revokedAt", CustomScalar<DateTime> | null> {
    return this.$_select("revokedAt") as any
  }

  /**
   * The user that revoked this invitation
   */
  revokedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"revokedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("revokedBy", options as any) as any
  }

  /**
   * The role the user will have in the organization once they've accepted the invitation
   */
  get role(): $Field<"role", OrganizationMemberRole> {
    return this.$_select("role") as any
  }

  /**
   * The slug of the invitation that can be used to find an invitation in the query root
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  sso<Sel extends Selection<OrganizationInvitationSSOType>>(
    selectorFn: (s: OrganizationInvitationSSOType) => [...Sel],
  ): $Field<"sso", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationSSOType()),
    }
    return this.$_select("sso", options as any) as any
  }

  /**
   * The current state of the invitation
   */
  get state(): $Field<"state", OrganizationInvitationStates> {
    return this.$_select("state") as any
  }

  /**
   * Teams that have been assigned to this invitation
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
    }>,
    Sel extends Selection<OrganizationInvitationTeamAssignmentConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
    }>,
    selectorFn: (s: OrganizationInvitationTeamAssignmentConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  teams<Sel extends Selection<OrganizationInvitationTeamAssignmentConnection>>(
    selectorFn: (s: OrganizationInvitationTeamAssignmentConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
      },
      args,

      selection: selectorFn(new OrganizationInvitationTeamAssignmentConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  /**
   * The UUID of the invitation
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class OrganizationInvitationConnection extends $Base<"OrganizationInvitationConnection"> {
  constructor() {
    super("OrganizationInvitationConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationInvitationEdge>>(
    selectorFn: (s: OrganizationInvitationEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationInvitationCreate
 */
export type OrganizationInvitationCreateInput = {
  clientMutationId?: string | null
  emails: Readonly<Array<string>>
  organizationID: string
  role?: OrganizationMemberRole | null
  sso?: OrganizationInvitationSSOInput | null
  teams?: Readonly<Array<OrganizationInvitationTeamAssignmentInput>> | null
}

/**
 * Autogenerated return type of OrganizationInvitationCreate.
 */
export class OrganizationInvitationCreatePayload extends $Base<"OrganizationInvitationCreatePayload"> {
  constructor() {
    super("OrganizationInvitationCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  invitationEdges<Sel extends Selection<OrganizationInvitationEdge>>(
    selectorFn: (s: OrganizationInvitationEdge) => [...Sel],
  ): $Field<"invitationEdges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationEdge()),
    }
    return this.$_select("invitationEdges", options as any) as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

export class OrganizationInvitationEdge extends $Base<"OrganizationInvitationEdge"> {
  constructor() {
    super("OrganizationInvitationEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<OrganizationInvitation>>(
    selectorFn: (s: OrganizationInvitation) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitation()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort organization invitations by
 */
export enum OrganizationInvitationOrders {
  /**
   * Order by email address alphabetically
   */
  EMAIL = "EMAIL",

  /**
   * Order by the most recently created invitations first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Permissions information about what actions the current user can do against this invitation
 */
export class OrganizationInvitationPermissions extends $Base<"OrganizationInvitationPermissions"> {
  constructor() {
    super("OrganizationInvitationPermissions")
  }

  /**
   * Whether the user can resend this invitation
   */
  organizationInvitationResend<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationInvitationResend", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationInvitationResend", options as any) as any
  }

  /**
   * Whether the user can revoke this invitation
   */
  organizationInvitationRevoke<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationInvitationRevoke", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationInvitationRevoke", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationInvitationResend
 */
export type OrganizationInvitationResendInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of OrganizationInvitationResend.
 */
export class OrganizationInvitationResendPayload extends $Base<"OrganizationInvitationResendPayload"> {
  constructor() {
    super("OrganizationInvitationResendPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organizationInvitation<Sel extends Selection<OrganizationInvitation>>(
    selectorFn: (s: OrganizationInvitation) => [...Sel],
  ): $Field<"organizationInvitation", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitation()),
    }
    return this.$_select("organizationInvitation", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationInvitationRevoke
 */
export type OrganizationInvitationRevokeInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of OrganizationInvitationRevoke.
 */
export class OrganizationInvitationRevokePayload extends $Base<"OrganizationInvitationRevokePayload"> {
  constructor() {
    super("OrganizationInvitationRevokePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  organizationInvitation<Sel extends Selection<OrganizationInvitation>>(
    selectorFn: (s: OrganizationInvitation) => [...Sel],
  ): $Field<"organizationInvitation", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitation()),
    }
    return this.$_select("organizationInvitation", options as any) as any
  }

  organizationInvitationEdge<Sel extends Selection<OrganizationInvitationEdge>>(
    selectorFn: (s: OrganizationInvitationEdge) => [...Sel],
  ): $Field<"organizationInvitationEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationEdge()),
    }
    return this.$_select("organizationInvitationEdge", options as any) as any
  }
}

export type OrganizationInvitationSSOInput = {
  mode: OrganizationMemberSSOModeEnum
}

/**
 * Information about the SSO setup for this invited organization member
 */
export class OrganizationInvitationSSOType extends $Base<"OrganizationInvitationSSOType"> {
  constructor() {
    super("OrganizationInvitationSSOType")
  }

  /**
   * The SSO mode of the invited organization member
   */
  get mode(): $Field<"mode", OrganizationMemberSSOModeEnum | null> {
    return this.$_select("mode") as any
  }
}

/**
 * All the possible states that an organization invitation can be
 */
export enum OrganizationInvitationStates {
  /**
   * The invitation is waiting for a user to accept it
   */
  PENDING = "PENDING",

  /**
   * The invitation was accepted by the person it was sent to
   */
  ACCEPTED = "ACCEPTED",

  /**
   * The invitation wasn't accepted and the link has expired
   */
  EXPIRED = "EXPIRED",

  /**
   * The invitation was revoked and can no longer be accepted
   */
  REVOKED = "REVOKED",
}

/**
 * A team that has been assigned to an invitation
 */
export class OrganizationInvitationTeamAssignment extends $Base<"OrganizationInvitationTeamAssignment"> {
  constructor() {
    super("OrganizationInvitationTeamAssignment")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The role that the user will have once they've accepted the invite
   */
  get role(): $Field<"role", TeamMemberRole> {
    return this.$_select("role") as any
  }

  /**
   * The team that this assignment refers to
   */
  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

export class OrganizationInvitationTeamAssignmentConnection
  extends $Base<"OrganizationInvitationTeamAssignmentConnection"> {
  constructor() {
    super("OrganizationInvitationTeamAssignmentConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationInvitationTeamAssignmentEdge>>(
    selectorFn: (s: OrganizationInvitationTeamAssignmentEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationTeamAssignmentEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class OrganizationInvitationTeamAssignmentEdge extends $Base<"OrganizationInvitationTeamAssignmentEdge"> {
  constructor() {
    super("OrganizationInvitationTeamAssignmentEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<OrganizationInvitationTeamAssignment>>(
    selectorFn: (s: OrganizationInvitationTeamAssignment) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationInvitationTeamAssignment()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Used to assign teams to organization invitation in mutations
 */
export type OrganizationInvitationTeamAssignmentInput = {
  id: string
  role: TeamMemberRole
}

/**
 * A member of an organization
 */
export class OrganizationMember extends $Base<"OrganizationMember"> {
  constructor() {
    super("OrganizationMember")
  }

  /**
   * Whether or not organizations are required to pay for this user
   */
  get complimentary(): $Field<"complimentary", boolean> {
    return this.$_select("complimentary") as any
  }

  /**
   * The time when this user was added to the organization
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added invited this user
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The time this member was last active within the organization
   */
  get lastSeenAt(): $Field<"lastSeenAt", CustomScalar<DateTime> | null> {
    return this.$_select("lastSeenAt") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  permissions<Sel extends Selection<OrganizationMemberPermissions>>(
    selectorFn: (s: OrganizationMemberPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * Pipelines the user has access to within the organization
   */
  pipelines<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: PipelineOrders | null
    }>,
    Sel extends Selection<OrganizationMemberPipelineConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: PipelineOrders | null
    }>,
    selectorFn: (s: OrganizationMemberPipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel>, GetVariables<Sel, Args>>
  pipelines<Sel extends Selection<OrganizationMemberPipelineConnection>>(
    selectorFn: (s: OrganizationMemberPipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel>, GetVariables<Sel>>
  pipelines(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        order: "PipelineOrders",
      },
      args,

      selection: selectorFn(new OrganizationMemberPipelineConnection()),
    }
    return this.$_select("pipelines", options as any) as any
  }

  /**
   * The users role within the organization
   */
  get role(): $Field<"role", OrganizationMemberRole> {
    return this.$_select("role") as any
  }

  security<Sel extends Selection<OrganizationMemberSecurity>>(
    selectorFn: (s: OrganizationMemberSecurity) => [...Sel],
  ): $Field<"security", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberSecurity()),
    }
    return this.$_select("security", options as any) as any
  }

  sso<Sel extends Selection<OrganizationMemberSSO>>(
    selectorFn: (s: OrganizationMemberSSO) => [...Sel],
  ): $Field<"sso", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberSSO()),
    }
    return this.$_select("sso", options as any) as any
  }

  /**
   * Teams that this user is a part of within the organization
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamMemberOrder | null
    }>,
    Sel extends Selection<TeamMemberConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamMemberOrder | null
    }>,
    selectorFn: (s: TeamMemberConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel>, GetVariables<Sel, Args>>
  teams<Sel extends Selection<TeamMemberConnection>>(
    selectorFn: (s: TeamMemberConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel>, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "TeamMemberOrder",
      },
      args,

      selection: selectorFn(new TeamMemberConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  user<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"user", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("user", options as any) as any
  }

  /**
   * The public UUID for this organization member
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class OrganizationMemberConnection extends $Base<"OrganizationMemberConnection"> {
  constructor() {
    super("OrganizationMemberConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationMemberEdge>>(
    selectorFn: (s: OrganizationMemberEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationMemberDelete
 */
export type OrganizationMemberDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of OrganizationMemberDelete.
 */
export class OrganizationMemberDeletePayload extends $Base<"OrganizationMemberDeletePayload"> {
  constructor() {
    super("OrganizationMemberDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedOrganizationMemberID(): $Field<"deletedOrganizationMemberID", string> {
    return this.$_select("deletedOrganizationMemberID") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  user<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"user", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("user", options as any) as any
  }
}

export class OrganizationMemberEdge extends $Base<"OrganizationMemberEdge"> {
  constructor() {
    super("OrganizationMemberEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<OrganizationMember>>(
    selectorFn: (s: OrganizationMember) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMember()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort members by
 */
export enum OrganizationMemberOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created members first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",

  /**
   * Order by relevance when searching for members
   */
  RELEVANCE = "RELEVANCE",
}

/**
 * Permissions information about what actions the current user can do against the organization membership record
 */
export class OrganizationMemberPermissions extends $Base<"OrganizationMemberPermissions"> {
  constructor() {
    super("OrganizationMemberPermissions")
  }

  /**
   * Whether the user can delete the user from the organization
   */
  organizationMemberDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationMemberDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationMemberDelete", options as any) as any
  }

  /**
   * Whether the user can update the organization's members role information
   */
  organizationMemberUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationMemberUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationMemberUpdate", options as any) as any
  }
}

/**
 * Represents the connection between a user an a pipeline within an organization
 */
export class OrganizationMemberPipeline extends $Base<"OrganizationMemberPipeline"> {
  constructor() {
    super("OrganizationMemberPipeline")
  }

  /**
   * The pipeline the user has access to within the organization
   */
  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

export class OrganizationMemberPipelineConnection extends $Base<"OrganizationMemberPipelineConnection"> {
  constructor() {
    super("OrganizationMemberPipelineConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<OrganizationMemberPipelineEdge>>(
    selectorFn: (s: OrganizationMemberPipelineEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberPipelineEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class OrganizationMemberPipelineEdge extends $Base<"OrganizationMemberPipelineEdge"> {
  constructor() {
    super("OrganizationMemberPipelineEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<OrganizationMemberPipeline>>(
    selectorFn: (s: OrganizationMemberPipeline) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMemberPipeline()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The roles a user can be within an organization
 */
export enum OrganizationMemberRole {
  /**
   * The user is a regular member of the organization
   */
  MEMBER = "MEMBER",

  /**
   * Has full access to the entire organization
   */
  ADMIN = "ADMIN",
}

/**
 * Information about the SSO setup for this organization member
 */
export class OrganizationMemberSSO extends $Base<"OrganizationMemberSSO"> {
  constructor() {
    super("OrganizationMemberSSO")
  }

  /**
   * SSO authorizations provided by your organization that have been created for this user
   */
  authorizations<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<SSOAuthorizationState>> | null
    }>,
    Sel extends Selection<SSOAuthorizationConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<SSOAuthorizationState>> | null
    }>,
    selectorFn: (s: SSOAuthorizationConnection) => [...Sel],
  ): $Field<"authorizations", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  authorizations<Sel extends Selection<SSOAuthorizationConnection>>(
    selectorFn: (s: SSOAuthorizationConnection) => [...Sel],
  ): $Field<"authorizations", GetOutput<Sel> | null, GetVariables<Sel>>
  authorizations(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        state: "[SSOAuthorizationState!]",
      },
      args,

      selection: selectorFn(new SSOAuthorizationConnection()),
    }
    return this.$_select("authorizations", options as any) as any
  }

  /**
   * The SSO mode of the organization member
   */
  get mode(): $Field<"mode", OrganizationMemberSSOModeEnum | null> {
    return this.$_select("mode") as any
  }
}

export type OrganizationMemberSSOInput = {
  mode: OrganizationMemberSSOModeEnum
}

/**
 * The SSO authorization modes you can use on a member
 */
export enum OrganizationMemberSSOModeEnum {
  /**
   * The member must use SSO to access your organization
   */
  REQUIRED = "REQUIRED",

  /**
   * The member can either use SSO or their email & password
   */
  OPTIONAL = "OPTIONAL",
}

/**
 * Information about what security settings the user has enabled in Buildkite
 */
export class OrganizationMemberSecurity extends $Base<"OrganizationMemberSecurity"> {
  constructor() {
    super("OrganizationMemberSecurity")
  }

  /**
   * If the user has secured their Buildkite user account with a password
   */
  get passwordProtected(): $Field<"passwordProtected", boolean> {
    return this.$_select("passwordProtected") as any
  }

  /**
   * If the user has enabled Two Factor Authentication
   */
  get twoFactorEnabled(): $Field<"twoFactorEnabled", boolean> {
    return this.$_select("twoFactorEnabled") as any
  }
}

export type OrganizationMemberSecurityInput = {
  passwordProtected?: boolean | null
  twoFactorEnabled?: boolean | null
}

/**
 * Autogenerated input type of OrganizationMemberUpdate
 */
export type OrganizationMemberUpdateInput = {
  clientMutationId?: string | null
  id: string
  role?: OrganizationMemberRole | null
  sso?: OrganizationMemberSSOInput | null
}

/**
 * Autogenerated return type of OrganizationMemberUpdate.
 */
export class OrganizationMemberUpdatePayload extends $Base<"OrganizationMemberUpdatePayload"> {
  constructor() {
    super("OrganizationMemberUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organizationMember<Sel extends Selection<OrganizationMember>>(
    selectorFn: (s: OrganizationMember) => [...Sel],
  ): $Field<"organizationMember", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMember()),
    }
    return this.$_select("organizationMember", options as any) as any
  }
}

/**
 * Permissions information about what actions the current user can do against the organization
 */
export class OrganizationPermissions extends $Base<"OrganizationPermissions"> {
  constructor() {
    super("OrganizationPermissions")
  }

  /**
   * Whether the user can create agent tokens
   */
  agentTokenCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentTokenCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentTokenCreate", options as any) as any
  }

  /**
   * Whether the user can access agent tokens
   */
  agentTokenView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentTokenView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentTokenView", options as any) as any
  }

  /**
   * Whether the user can create a see a list of agents in organization
   */
  agentView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"agentView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("agentView", options as any) as any
  }

  /**
   * Whether the user can access audit events for the organization
   */
  auditEventsView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"auditEventsView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("auditEventsView", options as any) as any
  }

  /**
   * Whether the user can change the notification services for the organization
   */
  notificationServiceUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"notificationServiceUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("notificationServiceUpdate", options as any) as any
  }

  /**
   * Whether the user can view and manage billing for the organization
   */
  organizationBillingUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationBillingUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationBillingUpdate", options as any) as any
  }

  /**
   * Whether the user can invite members from an organization
   */
  organizationInvitationCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationInvitationCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationInvitationCreate", options as any) as any
  }

  /**
   * Whether the user can update/remove members from an organization
   */
  organizationMemberUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationMemberUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationMemberUpdate", options as any) as any
  }

  /**
   * Whether the user can see members in the organization
   */
  organizationMemberView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationMemberView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationMemberView", options as any) as any
  }

  /**
   * Whether the user can see sensitive information about members in the organization
   */
  organizationMemberViewSensitive<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationMemberViewSensitive", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationMemberViewSensitive", options as any) as any
  }

  /**
   * Whether the user can change the organization name and related source code provider settings
   */
  organizationUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"organizationUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("organizationUpdate", options as any) as any
  }

  /**
   * Whether the user can create a new pipeline in the organization
   */
  pipelineCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineCreate", options as any) as any
  }

  /**
   * Whether the user can create a new pipeline without adding it to any teams within the organization
   */
  pipelineCreateWithoutTeams<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineCreateWithoutTeams", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineCreateWithoutTeams", options as any) as any
  }

  /**
   * Whether the user can create a see a list of pipelines in organization
   */
  pipelineView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineView", options as any) as any
  }

  /**
   * Whether the user can change SSO Providers for the organization
   */
  ssoProviderCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"ssoProviderCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("ssoProviderCreate", options as any) as any
  }

  /**
   * Whether the user can change SSO Providers for the organization
   */
  ssoProviderUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"ssoProviderUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("ssoProviderUpdate", options as any) as any
  }

  /**
   * Whether the user can create a see a list of suites in organization
   */
  suiteView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"suiteView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("suiteView", options as any) as any
  }

  /**
   * Whether the user can administer one or all the teams in the organization
   */
  teamAdmin<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamAdmin", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamAdmin", options as any) as any
  }

  /**
   * Whether the user can create teams for the organization
   */
  teamCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamCreate", options as any) as any
  }

  /**
   * Whether the user can toggle teams on/off for the organization
   */
  teamEnabledChange<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamEnabledChange", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamEnabledChange", options as any) as any
  }

  /**
   * Whether the user can see teams in the organization
   */
  teamView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamView", options as any) as any
  }
}

export class OrganizationRepositoryProvider extends $Interface<
  {
    OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub
    OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer
  },
  "OrganizationRepositoryProvider"
> {
  constructor() {
    super({
      OrganizationRepositoryProviderGitHub: OrganizationRepositoryProviderGitHub,
      OrganizationRepositoryProviderGitHubEnterpriseServer: OrganizationRepositoryProviderGitHubEnterpriseServer,
    }, "OrganizationRepositoryProvider")
  }

  /**
   * The name of the OrganizationRepositoryProvider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * GitHub installation associated with this organization
 */
export class OrganizationRepositoryProviderGitHub extends $Base<"OrganizationRepositoryProviderGitHub"> {
  constructor() {
    super("OrganizationRepositoryProviderGitHub")
  }

  /**
   * The ID of the provider
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the OrganizationRepositoryProvider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * Rate limit for this GitHub Installation
   */
  rateLimit<Sel extends Selection<OrganizationRepositoryProviderGitHubRateLimit>>(
    selectorFn: (s: OrganizationRepositoryProviderGitHubRateLimit) => [...Sel],
  ): $Field<"rateLimit", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationRepositoryProviderGitHubRateLimit()),
    }
    return this.$_select("rateLimit", options as any) as any
  }
}

/**
 * GitHub Enterprise Server associated with this organization
 */
export class OrganizationRepositoryProviderGitHubEnterpriseServer
  extends $Base<"OrganizationRepositoryProviderGitHubEnterpriseServer"> {
  constructor() {
    super("OrganizationRepositoryProviderGitHubEnterpriseServer")
  }

  /**
   * The ID of the provider
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the OrganizationRepositoryProvider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * Rate limit for GitHub Installation (GitHub App only)
   */
  rateLimit<Sel extends Selection<OrganizationRepositoryProviderGitHubRateLimit>>(
    selectorFn: (s: OrganizationRepositoryProviderGitHubRateLimit) => [...Sel],
  ): $Field<"rateLimit", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationRepositoryProviderGitHubRateLimit()),
    }
    return this.$_select("rateLimit", options as any) as any
  }

  /**
   * URL of the GitHub Enterprise Server
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }
}

export class OrganizationRepositoryProviderGitHubRateLimit
  extends $Base<"OrganizationRepositoryProviderGitHubRateLimit"> {
  constructor() {
    super("OrganizationRepositoryProviderGitHubRateLimit")
  }

  /**
   * The most recent rate limit data from GitHub
   */
  mostRecent<Sel extends Selection<GitHubRateLimit>>(
    selectorFn: (s: GitHubRateLimit) => [...Sel],
  ): $Field<"mostRecent", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new GitHubRateLimit()),
    }
    return this.$_select("mostRecent", options as any) as any
  }
}

/**
 * Autogenerated input type of OrganizationRevokeInactiveTokensAfterUpdateMutation
 */
export type OrganizationRevokeInactiveTokensAfterUpdateMutationInput = {
  clientMutationId?: string | null
  organizationId: string
  revokeInactiveTokensAfter: RevokeInactiveTokenPeriod
}

/**
 * Autogenerated return type of OrganizationRevokeInactiveTokensAfterUpdateMutation.
 */
export class OrganizationRevokeInactiveTokensAfterUpdateMutationPayload
  extends $Base<"OrganizationRevokeInactiveTokensAfterUpdateMutationPayload"> {
  constructor() {
    super("OrganizationRevokeInactiveTokensAfterUpdateMutationPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

/**
 * Single sign-on settings for an organization
 */
export class OrganizationSSO extends $Base<"OrganizationSSO"> {
  constructor() {
    super("OrganizationSSO")
  }

  /**
   * Whether this account is configured for single sign-on
   */
  get isEnabled(): $Field<"isEnabled", boolean> {
    return this.$_select("isEnabled") as any
  }

  /**
   * The single sign-on provider for this organization
   */
  provider<Sel extends Selection<OrganizationSSOProvider>>(
    selectorFn: (s: OrganizationSSOProvider) => [...Sel],
  ): $Field<"provider", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationSSOProvider()),
    }
    return this.$_select("provider", options as any) as any
  }
}

/**
 * Single sign-on provider information for an organization
 */
export class OrganizationSSOProvider extends $Base<"OrganizationSSOProvider"> {
  constructor() {
    super("OrganizationSSOProvider")
  }

  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }
}

/**
 * Information about pagination in a connection.
 */
export class PageInfo extends $Base<"PageInfo"> {
  constructor() {
    super("PageInfo")
  }

  /**
   * When paginating forwards, the cursor to continue.
   */
  get endCursor(): $Field<"endCursor", string | null> {
    return this.$_select("endCursor") as any
  }

  /**
   * When paginating forwards, are there more items?
   */
  get hasNextPage(): $Field<"hasNextPage", boolean> {
    return this.$_select("hasNextPage") as any
  }

  /**
   * When paginating backwards, are there more items?
   */
  get hasPreviousPage(): $Field<"hasPreviousPage", boolean> {
    return this.$_select("hasPreviousPage") as any
  }

  /**
   * When paginating backwards, the cursor to continue.
   */
  get startCursor(): $Field<"startCursor", string | null> {
    return this.$_select("startCursor") as any
  }
}

/**
 * The result of checking a permissions
 */
export class Permission extends $Base<"Permission"> {
  constructor() {
    super("Permission")
  }

  get allowed(): $Field<"allowed", boolean> {
    return this.$_select("allowed") as any
  }

  get code(): $Field<"code", string | null> {
    return this.$_select("code") as any
  }

  get message(): $Field<"message", string | null> {
    return this.$_select("message") as any
  }
}

/**
 * A pipeline
 */
export class Pipeline extends $Base<"Pipeline"> {
  constructor() {
    super("Pipeline")
  }

  /**
   * Whether existing builds can be rebuilt as new builds.
   */
  get allowRebuilds(): $Field<"allowRebuilds", boolean | null> {
    return this.$_select("allowRebuilds") as any
  }

  /**
   * Whether this pipeline has been archived
   */
  get archived(): $Field<"archived", boolean> {
    return this.$_select("archived") as any
  }

  /**
   * The time when the pipeline was archived
   */
  get archivedAt(): $Field<"archivedAt", CustomScalar<DateTime> | null> {
    return this.$_select("archivedAt") as any
  }

  /**
   * The user that archived this pipeline
   */
  archivedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"archivedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("archivedBy", options as any) as any
  }

  /**
   * The URL for build badge to the show the current build state for a pipeline.
   */
  get badgeURL(): $Field<"badgeURL", string> {
    return this.$_select("badgeURL") as any
  }

  /**
   * A branch filter pattern to limit which pushed branches trigger builds on this pipeline.
   */
  get branchConfiguration(): $Field<"branchConfiguration", string | null> {
    return this.$_select("branchConfiguration") as any
  }

  /**
   * Returns the builds for this pipeline
   */
  builds<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: Readonly<Array<string>> | null
      commit?: Readonly<Array<string>> | null
      metaData?: Readonly<Array<string>> | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    Sel extends Selection<BuildConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: Readonly<Array<string>> | null
      commit?: Readonly<Array<string>> | null
      metaData?: Readonly<Array<string>> | null
      createdAtFrom?: CustomScalar<DateTime> | null
      createdAtTo?: CustomScalar<DateTime> | null
    }>,
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  builds<Sel extends Selection<BuildConnection>>(
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel>>
  builds(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        state: "[BuildStates!]",
        branch: "[String!]",
        commit: "[String!]",
        metaData: "[String!]",
        createdAtFrom: "DateTime",
        createdAtTo: "DateTime",
      },
      args,

      selection: selectorFn(new BuildConnection()),
    }
    return this.$_select("builds", options as any) as any
  }

  /**
   * When a new build is created on a branch, any previous builds that are running on the same branch will be automatically cancelled
   */
  get cancelIntermediateBuilds(): $Field<"cancelIntermediateBuilds", boolean> {
    return this.$_select("cancelIntermediateBuilds") as any
  }

  /**
   * Limit which branches build cancelling applies to, for example `!main` will ensure that the main branch won't have it's builds automatically cancelled.
   */
  get cancelIntermediateBuildsBranchFilter(): $Field<"cancelIntermediateBuildsBranchFilter", string | null> {
    return this.$_select("cancelIntermediateBuildsBranchFilter") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  /**
   * The color of the pipeline
   */
  get color(): $Field<"color", string | null> {
    return this.$_select("color") as any
  }

  /**
   * The shortest length to which any git commit ID may be truncated while guaranteeing referring to a unique commit
   */
  get commitShortLength(): $Field<"commitShortLength", number> {
    return this.$_select("commitShortLength") as any
  }

  /**
   * The time when the pipeline was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user who created the pipeline
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The default branch for this pipeline
   */
  get defaultBranch(): $Field<"defaultBranch", string | null> {
    return this.$_select("defaultBranch") as any
  }

  /**
   * The default timeout in minutes for all command steps in this pipeline. This can still be overridden in any command step
   */
  get defaultTimeoutInMinutes(): $Field<"defaultTimeoutInMinutes", number | null> {
    return this.$_select("defaultTimeoutInMinutes") as any
  }

  /**
   * The short description of the pipeline
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * The emoji of the pipeline
   */
  get emoji(): $Field<"emoji", string | null> {
    return this.$_select("emoji") as any
  }

  /**
   * Returns true if the viewer has favorited this pipeline
   */
  get favorite(): $Field<"favorite", boolean> {
    return this.$_select("favorite") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  jobs<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    Sel extends Selection<JobConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<JobTypes>> | null
      state?: Readonly<Array<JobStates>> | null
      priority?: JobPrioritySearch | null
      agentQueryRules?: Readonly<Array<string>> | null
      concurrency?: JobConcurrencySearch | null
      passed?: boolean | null
      step?: JobStepSearch | null
      order?: JobOrder | null
    }>,
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  jobs<Sel extends Selection<JobConnection>>(
    selectorFn: (s: JobConnection) => [...Sel],
  ): $Field<"jobs", GetOutput<Sel> | null, GetVariables<Sel>>
  jobs(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        type: "[JobTypes!]",
        state: "[JobStates!]",
        priority: "JobPrioritySearch",
        agentQueryRules: "[String!]",
        concurrency: "JobConcurrencySearch",
        passed: "Boolean",
        step: "JobStepSearch",
        order: "JobOrder",
      },
      args,

      selection: selectorFn(new JobConnection()),
    }
    return this.$_select("jobs", options as any) as any
  }

  /**
   * The maximum timeout in minutes for all command steps in this pipeline. Any command step without a timeout or with a timeout greater than this value will be set to this value.
   */
  get maximumTimeoutInMinutes(): $Field<"maximumTimeoutInMinutes", number | null> {
    return this.$_select("maximumTimeoutInMinutes") as any
  }

  metrics<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<PipelineMetricConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: PipelineMetricConnection) => [...Sel],
  ): $Field<"metrics", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  metrics<Sel extends Selection<PipelineMetricConnection>>(
    selectorFn: (s: PipelineMetricConnection) => [...Sel],
  ): $Field<"metrics", GetOutput<Sel> | null, GetVariables<Sel>>
  metrics(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new PipelineMetricConnection()),
    }
    return this.$_select("metrics", options as any) as any
  }

  /**
   * The name of the pipeline
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The next build number
   */
  get nextBuildNumber(): $Field<"nextBuildNumber", number> {
    return this.$_select("nextBuildNumber") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  permissions<Sel extends Selection<PipelinePermissions>>(
    selectorFn: (s: PipelinePermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelinePermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  pipelineTemplate<Sel extends Selection<PipelineTemplate>>(
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"pipelineTemplate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("pipelineTemplate", options as any) as any
  }

  /**
   * Whether this pipeline is visible to everyone, including people outside this organization
   */
  get public(): $Field<"public", boolean> {
    return this.$_select("public") as any
  }

  /**
   * The repository for this pipeline
   */
  repository<Sel extends Selection<Repository>>(
    selectorFn: (s: Repository) => [...Sel],
  ): $Field<"repository", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Repository()),
    }
    return this.$_select("repository", options as any) as any
  }

  /**
   * Schedules for this pipeline
   */
  schedules<
    Args extends VariabledInput<{
      first?: number | null
    }>,
    Sel extends Selection<PipelineScheduleConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
    }>,
    selectorFn: (s: PipelineScheduleConnection) => [...Sel],
  ): $Field<"schedules", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  schedules<Sel extends Selection<PipelineScheduleConnection>>(
    selectorFn: (s: PipelineScheduleConnection) => [...Sel],
  ): $Field<"schedules", GetOutput<Sel> | null, GetVariables<Sel>>
  schedules(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
      },
      args,

      selection: selectorFn(new PipelineScheduleConnection()),
    }
    return this.$_select("schedules", options as any) as any
  }

  /**
   * When a new build is created on a branch, any previous builds that haven't yet started on the same branch will be automatically marked as skipped.
   */
  get skipIntermediateBuilds(): $Field<"skipIntermediateBuilds", boolean> {
    return this.$_select("skipIntermediateBuilds") as any
  }

  /**
   * Limit which branches build skipping applies to, for example `!main` will ensure that the main branch won't have it's builds automatically skipped.
   */
  get skipIntermediateBuildsBranchFilter(): $Field<"skipIntermediateBuildsBranchFilter", string | null> {
    return this.$_select("skipIntermediateBuildsBranchFilter") as any
  }

  /**
   * The slug of the pipeline
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  steps<Sel extends Selection<PipelineSteps>>(
    selectorFn: (s: PipelineSteps) => [...Sel],
  ): $Field<"steps", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineSteps()),
    }
    return this.$_select("steps", options as any) as any
  }

  /**
   * Tags that have been given to this pipeline
   */
  tags<Sel extends Selection<PipelineTag>>(
    selectorFn: (s: PipelineTag) => [...Sel],
  ): $Field<"tags", Array<GetOutput<Sel>>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTag()),
    }
    return this.$_select("tags", options as any) as any
  }

  /**
   * Teams associated with this pipeline
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamPipelineOrder | null
    }>,
    Sel extends Selection<TeamPipelineConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamPipelineOrder | null
    }>,
    selectorFn: (s: TeamPipelineConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  teams<Sel extends Selection<TeamPipelineConnection>>(
    selectorFn: (s: TeamPipelineConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        order: "TeamPipelineOrder",
      },
      args,

      selection: selectorFn(new TeamPipelineConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  /**
   * The URL for the pipeline
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID of the pipeline
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }

  /**
   * Whether this pipeline is visible to everyone, including people outside this organization
   */
  get visibility(): $Field<"visibility", PipelineVisibility> {
    return this.$_select("visibility") as any
  }

  /**
   * The URL to use in your repository settings for commit webhooks
   */
  get webhookURL(): $Field<"webhookURL", string> {
    return this.$_select("webhookURL") as any
  }
}

/**
 * The access levels that can be assigned to a pipeline
 */
export enum PipelineAccessLevels {
  /**
   * Allows edits, builds and reads
   */
  MANAGE_BUILD_AND_READ = "MANAGE_BUILD_AND_READ",

  /**
   * Allows builds and read only
   */
  BUILD_AND_READ = "BUILD_AND_READ",

  /**
   * Read only - no builds or edits
   */
  READ_ONLY = "READ_ONLY",
}

/**
 * Autogenerated input type of PipelineArchive
 */
export type PipelineArchiveInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineArchive.
 */
export class PipelineArchivePayload extends $Base<"PipelineArchivePayload"> {
  constructor() {
    super("PipelineArchivePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

export class PipelineConnection extends $Base<"PipelineConnection"> {
  constructor() {
    super("PipelineConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<PipelineEdge>>(
    selectorFn: (s: PipelineEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineCreate
 */
export type PipelineCreateInput = {
  allowRebuilds?: boolean | null
  branchConfiguration?: string | null
  cancelIntermediateBuilds?: boolean | null
  cancelIntermediateBuildsBranchFilter?: string | null
  clientMutationId?: string | null
  clusterId?: string | null
  color?: string | null
  defaultBranch?: string | null
  defaultTimeoutInMinutes?: number | null
  description?: string | null
  emoji?: string | null
  maximumTimeoutInMinutes?: number | null
  name: string
  nextBuildNumber?: number | null
  organizationId: string
  pipelineTemplateId?: string | null
  repository: PipelineRepositoryInput
  skipIntermediateBuilds?: boolean | null
  skipIntermediateBuildsBranchFilter?: string | null
  steps?: PipelineStepsInput | null
  tags?: Readonly<Array<PipelineTagInput>> | null
  teams?: Readonly<Array<PipelineTeamAssignmentInput>> | null
  visibility?: PipelineVisibility | null
}

/**
 * Autogenerated return type of PipelineCreate.
 */
export class PipelineCreatePayload extends $Base<"PipelineCreatePayload"> {
  constructor() {
    super("PipelineCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  pipelineEdge<Sel extends Selection<PipelineEdge>>(
    selectorFn: (s: PipelineEdge) => [...Sel],
  ): $Field<"pipelineEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineEdge()),
    }
    return this.$_select("pipelineEdge", options as any) as any
  }

  pipelineTemplate<Sel extends Selection<PipelineTemplate>>(
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"pipelineTemplate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("pipelineTemplate", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineCreateWebhook
 */
export type PipelineCreateWebhookInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineCreateWebhook.
 */
export class PipelineCreateWebhookPayload extends $Base<"PipelineCreateWebhookPayload"> {
  constructor() {
    super("PipelineCreateWebhookPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get pipelineID(): $Field<"pipelineID", string> {
    return this.$_select("pipelineID") as any
  }
}

/**
 * Autogenerated input type of PipelineDelete
 */
export type PipelineDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineDelete.
 */
export class PipelineDeletePayload extends $Base<"PipelineDeletePayload"> {
  constructor() {
    super("PipelineDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedPipelineID(): $Field<"deletedPipelineID", string> {
    return this.$_select("deletedPipelineID") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

export class PipelineEdge extends $Base<"PipelineEdge"> {
  constructor() {
    super("PipelineEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineFavorite
 */
export type PipelineFavoriteInput = {
  clientMutationId?: string | null
  favorite: boolean
  id: string
}

/**
 * Autogenerated return type of PipelineFavorite.
 */
export class PipelineFavoritePayload extends $Base<"PipelineFavoritePayload"> {
  constructor() {
    super("PipelineFavoritePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

/**
 * A metric for a pipeline
 */
export class PipelineMetric extends $Base<"PipelineMetric"> {
  constructor() {
    super("PipelineMetric")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The label of this metric
   */
  get label(): $Field<"label", string> {
    return this.$_select("label") as any
  }

  /**
   * The URL for this metric
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The value for this metric
   */
  get value(): $Field<"value", string | null> {
    return this.$_select("value") as any
  }
}

export class PipelineMetricConnection extends $Base<"PipelineMetricConnection"> {
  constructor() {
    super("PipelineMetricConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<PipelineMetricEdge>>(
    selectorFn: (s: PipelineMetricEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineMetricEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class PipelineMetricEdge extends $Base<"PipelineMetricEdge"> {
  constructor() {
    super("PipelineMetricEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<PipelineMetric>>(
    selectorFn: (s: PipelineMetric) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineMetric()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort pipelines by
 */
export enum PipelineOrders {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by favorites first alphabetically, then the rest of the pipelines alphabetically
   */
  NAME_WITH_FAVORITES_FIRST = "NAME_WITH_FAVORITES_FIRST",

  /**
   * Order by the most recently created pipelines first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",

  /**
   * Order by relevance when searching for pipelines
   */
  RELEVANCE = "RELEVANCE",
}

/**
 * Permission information about what actions the current user can do against the pipeline
 */
export class PipelinePermissions extends $Base<"PipelinePermissions"> {
  constructor() {
    super("PipelinePermissions")
  }

  /**
   * Whether the user can create builds on this pipeline
   */
  buildCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"buildCreate", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("buildCreate", options as any) as any
  }

  /**
   * Whether the user can delete this pipeline
   */
  pipelineDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineDelete", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineDelete", options as any) as any
  }

  /**
   * Whether the user can favorite this pipeline
   */
  pipelineFavorite<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineFavorite", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineFavorite", options as any) as any
  }

  /**
   * Whether the user can create schedules on this pipeline
   */
  pipelineScheduleCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineScheduleCreate", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineScheduleCreate", options as any) as any
  }

  /**
   * Whether the user can edit the settings of this pipeline
   */
  pipelineUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineUpdate", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineUpdate", options as any) as any
  }
}

/**
 * Repository information for a pipeline
 */
export type PipelineRepositoryInput = {
  url: string
}

/**
 * Autogenerated input type of PipelineRotateWebhookURL
 */
export type PipelineRotateWebhookURLInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineRotateWebhookURL.
 */
export class PipelineRotateWebhookURLPayload extends $Base<"PipelineRotateWebhookURLPayload"> {
  constructor() {
    super("PipelineRotateWebhookURLPayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

/**
 * A schedule of when a build should automatically triggered for a Pipeline
 */
export class PipelineSchedule extends $Base<"PipelineSchedule"> {
  constructor() {
    super("PipelineSchedule")
  }

  /**
   * The branch to use for builds that this schedule triggers. Defaults to to the default branch in the Pipeline
   */
  get branch(): $Field<"branch", string | null> {
    return this.$_select("branch") as any
  }

  /**
   * Returns the builds created by this schedule
   */
  builds<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<BuildConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  builds<Sel extends Selection<BuildConnection>>(
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel>>
  builds(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new BuildConnection()),
    }
    return this.$_select("builds", options as any) as any
  }

  /**
   * The commit to use for builds that this schedule triggers. Defaults to `HEAD`
   */
  get commit(): $Field<"commit", string | null> {
    return this.$_select("commit") as any
  }

  /**
   * The time when this schedule was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * A definition of the trigger build schedule in cron syntax
   */
  get cronline(): $Field<"cronline", string> {
    return this.$_select("cronline") as any
  }

  /**
   * If this Pipeline schedule is currently enabled
   */
  get enabled(): $Field<"enabled", boolean | null> {
    return this.$_select("enabled") as any
  }

  /**
   * Environment variables passed to any triggered builds
   */
  get env(): $Field<"env", Readonly<Array<string>> | null> {
    return this.$_select("env") as any
  }

  /**
   * The time when this schedule failed
   */
  get failedAt(): $Field<"failedAt", CustomScalar<DateTime> | null> {
    return this.$_select("failedAt") as any
  }

  /**
   * If the last attempt at triggering this scheduled build fails, this will be the reason
   */
  get failedMessage(): $Field<"failedMessage", string | null> {
    return this.$_select("failedMessage") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * A short description of the Pipeline schedule
   */
  get label(): $Field<"label", string> {
    return this.$_select("label") as any
  }

  /**
   * The message to use for builds that this schedule triggers
   */
  get message(): $Field<"message", string | null> {
    return this.$_select("message") as any
  }

  /**
   * The time when this schedule will create a build next
   */
  get nextBuildAt(): $Field<"nextBuildAt", CustomScalar<DateTime> | null> {
    return this.$_select("nextBuildAt") as any
  }

  permissions<Sel extends Selection<PipelineSchedulePermissions>>(
    selectorFn: (s: PipelineSchedulePermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineSchedulePermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  /**
   * The UUID of the Pipeline schedule
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class PipelineScheduleConnection extends $Base<"PipelineScheduleConnection"> {
  constructor() {
    super("PipelineScheduleConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<PipelineScheduleEdge>>(
    selectorFn: (s: PipelineScheduleEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineScheduleEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineScheduleCreate
 */
export type PipelineScheduleCreateInput = {
  branch?: string | null
  clientMutationId?: string | null
  commit?: string | null
  cronline?: string | null
  enabled?: boolean | null
  env?: string | null
  label?: string | null
  message?: string | null
  pipelineID: string
}

/**
 * Autogenerated return type of PipelineScheduleCreate.
 */
export class PipelineScheduleCreatePayload extends $Base<"PipelineScheduleCreatePayload"> {
  constructor() {
    super("PipelineScheduleCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  pipelineScheduleEdge<Sel extends Selection<PipelineScheduleEdge>>(
    selectorFn: (s: PipelineScheduleEdge) => [...Sel],
  ): $Field<"pipelineScheduleEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineScheduleEdge()),
    }
    return this.$_select("pipelineScheduleEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineScheduleDelete
 */
export type PipelineScheduleDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineScheduleDelete.
 */
export class PipelineScheduleDeletePayload extends $Base<"PipelineScheduleDeletePayload"> {
  constructor() {
    super("PipelineScheduleDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedPipelineScheduleID(): $Field<"deletedPipelineScheduleID", string> {
    return this.$_select("deletedPipelineScheduleID") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

export class PipelineScheduleEdge extends $Base<"PipelineScheduleEdge"> {
  constructor() {
    super("PipelineScheduleEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<PipelineSchedule>>(
    selectorFn: (s: PipelineSchedule) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineSchedule()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Permission information about what actions the current user can do against the pipeline schedule
 */
export class PipelineSchedulePermissions extends $Base<"PipelineSchedulePermissions"> {
  constructor() {
    super("PipelineSchedulePermissions")
  }

  /**
   * Whether the user can delete the schedule
   */
  pipelineScheduleDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineScheduleDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineScheduleDelete", options as any) as any
  }

  /**
   * Whether the user can update the schedule
   */
  pipelineScheduleUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineScheduleUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineScheduleUpdate", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineScheduleUpdate
 */
export type PipelineScheduleUpdateInput = {
  branch?: string | null
  clientMutationId?: string | null
  commit?: string | null
  cronline?: string | null
  enabled?: boolean | null
  env?: string | null
  id: string
  label?: string | null
  message?: string | null
}

/**
 * Autogenerated return type of PipelineScheduleUpdate.
 */
export class PipelineScheduleUpdatePayload extends $Base<"PipelineScheduleUpdatePayload"> {
  constructor() {
    super("PipelineScheduleUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipelineSchedule<Sel extends Selection<PipelineSchedule>>(
    selectorFn: (s: PipelineSchedule) => [...Sel],
  ): $Field<"pipelineSchedule", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineSchedule()),
    }
    return this.$_select("pipelineSchedule", options as any) as any
  }
}

/**
 * A Pipeline identifier using a slug, and optionally negated with a leading `!`
 */
export type PipelineSelector = unknown

/**
 * Steps defined on a pipeline
 */
export class PipelineSteps extends $Base<"PipelineSteps"> {
  constructor() {
    super("PipelineSteps")
  }

  /**
   * A YAML representation of the pipeline steps
   */
  get yaml(): $Field<"yaml", CustomScalar<YAML> | null> {
    return this.$_select("yaml") as any
  }
}

/**
 * Step definition for a pipeline
 */
export type PipelineStepsInput = {
  yaml: string
}

/**
 * A tag associated with a pipeline
 */
export class PipelineTag extends $Base<"PipelineTag"> {
  constructor() {
    super("PipelineTag")
  }

  /**
   * The label for this tag
   */
  get label(): $Field<"label", string> {
    return this.$_select("label") as any
  }
}

/**
 * Tag associated with a pipeline
 */
export type PipelineTagInput = {
  label: string
}

/**
 * Used to assign teams to pipelines
 */
export type PipelineTeamAssignmentInput = {
  accessLevel?: PipelineAccessLevels | null
  id: string
}

/**
 * A template defining a fixed step configuration for a pipeline
 */
export class PipelineTemplate extends $Base<"PipelineTemplate"> {
  constructor() {
    super("PipelineTemplate")
  }

  /**
   * If the pipeline template is available for assignment by non admin users
   */
  get available(): $Field<"available", boolean> {
    return this.$_select("available") as any
  }

  /**
   * A YAML representation of the step configuration
   */
  get configuration(): $Field<"configuration", CustomScalar<YAML>> {
    return this.$_select("configuration") as any
  }

  /**
   * The time when the template was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user who created the template
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The short description of the template
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the template
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The last time the template was changed
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime>> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The user who last updated the template
   */
  updatedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"updatedBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("updatedBy", options as any) as any
  }

  /**
   * The UUID for the template
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class PipelineTemplateConnection extends $Base<"PipelineTemplateConnection"> {
  constructor() {
    super("PipelineTemplateConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<PipelineTemplateEdge>>(
    selectorFn: (s: PipelineTemplateEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplateEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineTemplateCreate
 */
export type PipelineTemplateCreateInput = {
  available?: boolean | null
  clientMutationId?: string | null
  configuration: string
  description?: string | null
  name: string
  organizationId: string
}

/**
 * Autogenerated return type of PipelineTemplateCreate.
 */
export class PipelineTemplateCreatePayload extends $Base<"PipelineTemplateCreatePayload"> {
  constructor() {
    super("PipelineTemplateCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipelineTemplate<Sel extends Selection<PipelineTemplate>>(
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"pipelineTemplate", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("pipelineTemplate", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineTemplateDelete
 */
export type PipelineTemplateDeleteInput = {
  clientMutationId?: string | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of PipelineTemplateDelete.
 */
export class PipelineTemplateDeletePayload extends $Base<"PipelineTemplateDeletePayload"> {
  constructor() {
    super("PipelineTemplateDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedPipelineTemplateId(): $Field<"deletedPipelineTemplateId", string> {
    return this.$_select("deletedPipelineTemplateId") as any
  }
}

export class PipelineTemplateEdge extends $Base<"PipelineTemplateEdge"> {
  constructor() {
    super("PipelineTemplateEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<PipelineTemplate>>(
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort pipeline templates by
 */
export enum PipelineTemplateOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created pipeline templates first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Autogenerated input type of PipelineTemplateUpdate
 */
export type PipelineTemplateUpdateInput = {
  available?: boolean | null
  clientMutationId?: string | null
  configuration?: string | null
  description?: string | null
  id: string
  name?: string | null
  organizationId: string
}

/**
 * Autogenerated return type of PipelineTemplateUpdate.
 */
export class PipelineTemplateUpdatePayload extends $Base<"PipelineTemplateUpdatePayload"> {
  constructor() {
    super("PipelineTemplateUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipelineTemplate<Sel extends Selection<PipelineTemplate>>(
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"pipelineTemplate", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("pipelineTemplate", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineUnarchive
 */
export type PipelineUnarchiveInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of PipelineUnarchive.
 */
export class PipelineUnarchivePayload extends $Base<"PipelineUnarchivePayload"> {
  constructor() {
    super("PipelineUnarchivePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

/**
 * Autogenerated input type of PipelineUpdate
 */
export type PipelineUpdateInput = {
  allowRebuilds?: boolean | null
  archived?: boolean | null
  branchConfiguration?: string | null
  cancelIntermediateBuilds?: boolean | null
  cancelIntermediateBuildsBranchFilter?: string | null
  clientMutationId?: string | null
  clusterId?: string | null
  color?: string | null
  defaultBranch?: string | null
  defaultTimeoutInMinutes?: number | null
  description?: string | null
  emoji?: string | null
  id: string
  maximumTimeoutInMinutes?: number | null
  name?: string | null
  nextBuildNumber?: number | null
  pipelineTemplateId?: string | null
  repository?: PipelineRepositoryInput | null
  skipIntermediateBuilds?: boolean | null
  skipIntermediateBuildsBranchFilter?: string | null
  steps?: PipelineStepsInput | null
  tags?: Readonly<Array<PipelineTagInput>> | null
  visibility?: PipelineVisibility | null
}

/**
 * Autogenerated return type of PipelineUpdate.
 */
export class PipelineUpdatePayload extends $Base<"PipelineUpdatePayload"> {
  constructor() {
    super("PipelineUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }
}

/**
 * The visibility of the pipeline
 */
export enum PipelineVisibility {
  /**
   * The pipeline is public
   */
  PUBLIC = "PUBLIC",

  /**
   * The pipeline is private
   */
  PRIVATE = "PRIVATE",
}

/**
 * A pull request on a provider
 */
export class PullRequest extends $Base<"PullRequest"> {
  constructor() {
    super("PullRequest")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * The query root for this schema
 */
export class Query extends $Base<"Query"> {
  constructor() {
    super("Query")
  }

  /**
   * Find an agent by its slug
   */
  agent<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<Agent>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: Agent) => [...Sel],
  ): $Field<"agent", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new Agent()),
    }
    return this.$_select("agent", options as any) as any
  }

  /**
   * Find an agent token by its slug
   */
  agentToken<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<AgentToken>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: AgentToken) => [...Sel],
  ): $Field<"agentToken", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new AgentToken()),
    }
    return this.$_select("agentToken", options as any) as any
  }

  /**
   * Find a API Access Token code
   */
  apiAccessTokenCode<
    Args extends VariabledInput<{
      code: string
    }>,
    Sel extends Selection<APIAccessTokenCode>,
  >(
    args: ExactArgNames<Args, {
      code: string
    }>,
    selectorFn: (s: APIAccessTokenCode) => [...Sel],
  ): $Field<"apiAccessTokenCode", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        code: "ID!",
      },
      args,

      selection: selectorFn(new APIAccessTokenCode()),
    }
    return this.$_select("apiAccessTokenCode", options as any) as any
  }

  /**
   * Find an artifact by its UUID
   */
  artifact<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<Artifact>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: Artifact) => [...Sel],
  ): $Field<"artifact", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new Artifact()),
    }
    return this.$_select("artifact", options as any) as any
  }

  /**
   * Find an audit event via its uuid
   */
  auditEvent<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<AuditEvent>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: AuditEvent) => [...Sel],
  ): $Field<"auditEvent", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new AuditEvent()),
    }
    return this.$_select("auditEvent", options as any) as any
  }

  /**
   * Find a build
   */
  build<
    Args extends VariabledInput<{
      slug?: string | null
      uuid?: string | null
    }>,
    Sel extends Selection<Build>,
  >(
    args: ExactArgNames<Args, {
      slug?: string | null
      uuid?: string | null
    }>,
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  build<Sel extends Selection<Build>>(
    selectorFn: (s: Build) => [...Sel],
  ): $Field<"build", GetOutput<Sel> | null, GetVariables<Sel>>
  build(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        slug: "ID",
        uuid: "ID",
      },
      args,

      selection: selectorFn(new Build()),
    }
    return this.$_select("build", options as any) as any
  }

  /**
   * Find a GraphQL snippet
   */
  graphQLSnippet<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<GraphQLSnippet>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: GraphQLSnippet) => [...Sel],
  ): $Field<"graphQLSnippet", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "String!",
      },
      args,

      selection: selectorFn(new GraphQLSnippet()),
    }
    return this.$_select("graphQLSnippet", options as any) as any
  }

  /**
   * Find a build job
   */
  job<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<Job>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: Job) => [...Sel],
  ): $Field<"job", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new Job()),
    }
    return this.$_select("job", options as any) as any
  }

  /**
   * Fetches an object given its ID.
   */
  node<
    Args extends VariabledInput<{
      id: string
    }>,
    Sel extends Selection<Node>,
  >(
    args: ExactArgNames<Args, {
      id: string
    }>,
    selectorFn: (s: Node) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        id: "ID!",
      },
      args,

      selection: selectorFn(new Node()),
    }
    return this.$_select("node", options as any) as any
  }

  /**
   * Find a notification service via its UUID
   */
  notificationService<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<NotificationService>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: NotificationService) => [...Sel],
  ): $Field<"notificationService", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new NotificationService()),
    }
    return this.$_select("notificationService", options as any) as any
  }

  /**
   * Find an organization
   */
  organization<
    Args extends VariabledInput<{
      slug?: string | null
      uuid?: string | null
    }>,
    Sel extends Selection<Organization>,
  >(
    args: ExactArgNames<Args, {
      slug?: string | null
      uuid?: string | null
    }>,
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>>
  organization(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        slug: "ID",
        uuid: "ID",
      },
      args,

      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Find an organization invitation via its slug
   */
  organizationInvitation<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<OrganizationInvitation>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: OrganizationInvitation) => [...Sel],
  ): $Field<"organizationInvitation", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new OrganizationInvitation()),
    }
    return this.$_select("organizationInvitation", options as any) as any
  }

  /**
   * Find an organization membership via its slug
   */
  organizationMember<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<OrganizationMember>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: OrganizationMember) => [...Sel],
  ): $Field<"organizationMember", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new OrganizationMember()),
    }
    return this.$_select("organizationMember", options as any) as any
  }

  /**
   * Find a pipeline
   */
  pipeline<
    Args extends VariabledInput<{
      slug?: string | null
      uuid?: string | null
    }>,
    Sel extends Selection<Pipeline>,
  >(
    args: ExactArgNames<Args, {
      slug?: string | null
      uuid?: string | null
    }>,
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>>
  pipeline(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        slug: "ID",
        uuid: "ID",
      },
      args,

      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  /**
   * Find a pipeline schedule by its slug
   */
  pipelineSchedule<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<PipelineSchedule>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: PipelineSchedule) => [...Sel],
  ): $Field<"pipelineSchedule", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new PipelineSchedule()),
    }
    return this.$_select("pipelineSchedule", options as any) as any
  }

  /**
   * Find a pipeline template
   */
  pipelineTemplate<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<PipelineTemplate>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: PipelineTemplate) => [...Sel],
  ): $Field<"pipelineTemplate", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new PipelineTemplate()),
    }
    return this.$_select("pipelineTemplate", options as any) as any
  }

  /**
   * Find a registry
   */
  registry<
    Args extends VariabledInput<{
      slug?: string | null
      uuid?: string | null
    }>,
    Sel extends Selection<Registry>,
  >(
    args: ExactArgNames<Args, {
      slug?: string | null
      uuid?: string | null
    }>,
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  registry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel> | null, GetVariables<Sel>>
  registry(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        slug: "ID",
        uuid: "ID",
      },
      args,

      selection: selectorFn(new Registry()),
    }
    return this.$_select("registry", options as any) as any
  }

  /**
   * Find a rule via its UUID
   */
  rule<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<Rule>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: Rule) => [...Sel],
  ): $Field<"rule", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new Rule()),
    }
    return this.$_select("rule", options as any) as any
  }

  /**
   * Find a secret via its uuid. This does not contain the value of the secret or encrypted material.
   */
  secret<
    Args extends VariabledInput<{
      uuid: string
    }>,
    Sel extends Selection<Secret>,
  >(
    args: ExactArgNames<Args, {
      uuid: string
    }>,
    selectorFn: (s: Secret) => [...Sel],
  ): $Field<"secret", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        uuid: "ID!",
      },
      args,

      selection: selectorFn(new Secret()),
    }
    return this.$_select("secret", options as any) as any
  }

  /**
   * Find an sso provider either using it's slug, or UUID
   */
  ssoProvider<
    Args extends VariabledInput<{
      slug?: string | null
      uuid?: string | null
    }>,
    Sel extends Selection<SSOProvider>,
  >(
    args: ExactArgNames<Args, {
      slug?: string | null
      uuid?: string | null
    }>,
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel> | null, GetVariables<Sel>>
  ssoProvider(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        slug: "ID",
        uuid: "ID",
      },
      args,

      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }

  /**
   * Find a team
   */
  team<
    Args extends VariabledInput<{
      slug: string
    }>,
    Sel extends Selection<Team>,
  >(
    args: ExactArgNames<Args, {
      slug: string
    }>,
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        slug: "ID!",
      },
      args,

      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  /**
   * Context of the current user using the GraphQL API
   */
  viewer<Sel extends Selection<Viewer>>(
    selectorFn: (s: Viewer) => [...Sel],
  ): $Field<"viewer", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Viewer()),
    }
    return this.$_select("viewer", options as any) as any
  }
}

/**
 * A recovery code
 */
export class RecoveryCode extends $Base<"RecoveryCode"> {
  constructor() {
    super("RecoveryCode")
  }

  /**
   * The recovery code.
   */
  get code(): $Field<"code", string> {
    return this.$_select("code") as any
  }

  /**
   * Whether the recovery codes is used
   */
  get consumed(): $Field<"consumed", boolean> {
    return this.$_select("consumed") as any
  }

  /**
   * Foo
   */
  get consumedAt(): $Field<"consumedAt", string | null> {
    return this.$_select("consumedAt") as any
  }
}

/**
 * A batch of recovery codes
 */
export class RecoveryCodeBatch extends $Base<"RecoveryCodeBatch"> {
  constructor() {
    super("RecoveryCodeBatch")
  }

  /**
   * Whether the batch of recovery codes is active
   */
  get active(): $Field<"active", boolean> {
    return this.$_select("active") as any
  }

  /**
   * The recovery codes from this batch. Codes are consumed when used, and codes will be included in this list whether consumed or not
   */
  codes<Sel extends Selection<RecoveryCode>>(
    selectorFn: (s: RecoveryCode) => [...Sel],
  ): $Field<"codes", Array<GetOutput<Sel>>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RecoveryCode()),
    }
    return this.$_select("codes", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A registry
 */
export class Registry extends $Base<"Registry"> {
  constructor() {
    super("Registry")
  }

  /**
   * The hex code for the registry navatar background color in the Registries page
   */
  get color(): $Field<"color", string | null> {
    return this.$_select("color") as any
  }

  /**
   * The time when the registry was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The description of the registry
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * The emoji that will display as a registry navatar in the Registries page
   */
  get emoji(): $Field<"emoji", string | null> {
    return this.$_select("emoji") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the registry
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * The slug of the registry
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  /**
   * Teams associated with this registry
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamRegistryOrder | null
    }>,
    Sel extends Selection<TeamRegistryConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamRegistryOrder | null
    }>,
    selectorFn: (s: TeamRegistryConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  teams<Sel extends Selection<TeamRegistryConnection>>(
    selectorFn: (s: TeamRegistryConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        order: "TeamRegistryOrder",
      },
      args,

      selection: selectorFn(new TeamRegistryConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  /**
   * The time when the registry was updated
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The URL for the registry
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The access levels that can be assigned to a registry
 */
export enum RegistryAccessLevels {
  /**
   * Read only
   */
  READ_ONLY = "READ_ONLY",

  /**
   * Allow read and push
   */
  READ_AND_WRITE = "READ_AND_WRITE",

  /**
   * Allow read, push, delete and management
   */
  READ_WRITE_AND_ADMIN = "READ_WRITE_AND_ADMIN",
}

export class RegistryConnection extends $Base<"RegistryConnection"> {
  constructor() {
    super("RegistryConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<RegistryEdge>>(
    selectorFn: (s: RegistryEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RegistryEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class RegistryEdge extends $Base<"RegistryEdge"> {
  constructor() {
    super("RegistryEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort registries by
 */
export enum RegistryOrders {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created registries first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",

  /**
   * Order by relevance when searching for registries
   */
  RELEVANCE = "RELEVANCE",
}

/**
 * A registry token
 */
export class RegistryToken extends $Base<"RegistryToken"> {
  constructor() {
    super("RegistryToken")
  }

  /**
   * The time when this token was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user who created this token
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The description of the purpose for this registry token
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  registry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("registry", options as any) as any
  }

  /**
   * The time when this token was last updated
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The user who last updated this token
   */
  updatedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"updatedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("updatedBy", options as any) as any
  }

  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A repository associated with a pipeline
 */
export class Repository extends $Base<"Repository"> {
  constructor() {
    super("Repository")
  }

  /**
   * The repository’s provider
   */
  provider<Sel extends Selection<RepositoryProvider>>(
    selectorFn: (s: RepositoryProvider) => [...Sel],
  ): $Field<"provider", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProvider()),
    }
    return this.$_select("provider", options as any) as any
  }

  /**
   * The git URL for this repository
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }
}

export class RepositoryProvider extends $Interface<
  {
    RepositoryProviderBeanstalk: RepositoryProviderBeanstalk
    RepositoryProviderBitbucket: RepositoryProviderBitbucket
    RepositoryProviderBitbucketServer: RepositoryProviderBitbucketServer
    RepositoryProviderCodebase: RepositoryProviderCodebase
    RepositoryProviderGithub: RepositoryProviderGithub
    RepositoryProviderGithubEnterprise: RepositoryProviderGithubEnterprise
    RepositoryProviderGitlab: RepositoryProviderGitlab
    RepositoryProviderGitlabCommunity: RepositoryProviderGitlabCommunity
    RepositoryProviderGitlabEnterprise: RepositoryProviderGitlabEnterprise
    RepositoryProviderUnknown: RepositoryProviderUnknown
  },
  "RepositoryProvider"
> {
  constructor() {
    super({
      RepositoryProviderBeanstalk: RepositoryProviderBeanstalk,
      RepositoryProviderBitbucket: RepositoryProviderBitbucket,
      RepositoryProviderBitbucketServer: RepositoryProviderBitbucketServer,
      RepositoryProviderCodebase: RepositoryProviderCodebase,
      RepositoryProviderGithub: RepositoryProviderGithub,
      RepositoryProviderGithubEnterprise: RepositoryProviderGithubEnterprise,
      RepositoryProviderGitlab: RepositoryProviderGitlab,
      RepositoryProviderGitlabCommunity: RepositoryProviderGitlabCommunity,
      RepositoryProviderGitlabEnterprise: RepositoryProviderGitlabEnterprise,
      RepositoryProviderUnknown: RepositoryProviderUnknown,
    }, "RepositoryProvider")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * A pipeline's repository is being provided by Beanstalk
 */
export class RepositoryProviderBeanstalk extends $Base<"RepositoryProviderBeanstalk"> {
  constructor() {
    super("RepositoryProviderBeanstalk")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderBeanstalkSettings>>(
    selectorFn: (s: RepositoryProviderBeanstalkSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderBeanstalkSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Settings for a Beanstalk repository.
 */
export class RepositoryProviderBeanstalkSettings extends $Base<"RepositoryProviderBeanstalkSettings"> {
  constructor() {
    super("RepositoryProviderBeanstalkSettings")
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

/**
 * A pipeline's repository is being provided by Bitbucket
 */
export class RepositoryProviderBitbucket extends $Base<"RepositoryProviderBitbucket"> {
  constructor() {
    super("RepositoryProviderBitbucket")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderBitbucketSettings>>(
    selectorFn: (s: RepositoryProviderBitbucketSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderBitbucketSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * A pipeline's repository is being provided by Bitbucket Server
 */
export class RepositoryProviderBitbucketServer extends $Base<"RepositoryProviderBitbucketServer"> {
  constructor() {
    super("RepositoryProviderBitbucketServer")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderBitbucketServerSettings>>(
    selectorFn: (s: RepositoryProviderBitbucketServerSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderBitbucketServerSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Settings for Bitbucket Server repository
 */
export class RepositoryProviderBitbucketServerSettings extends $Base<"RepositoryProviderBitbucketServerSettings"> {
  constructor() {
    super("RepositoryProviderBitbucketServerSettings")
  }

  /**
   * Whether to create builds when branches are pushed.
   */
  get buildBranches(): $Field<"buildBranches", boolean> {
    return this.$_select("buildBranches") as any
  }

  /**
   * Whether to create builds for commits that are part of a Pull Request.
   */
  get buildPullRequests(): $Field<"buildPullRequests", boolean> {
    return this.$_select("buildPullRequests") as any
  }

  /**
   * Whether to create builds when tags are pushed.
   */
  get buildTags(): $Field<"buildTags", boolean> {
    return this.$_select("buildTags") as any
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

/**
 * Settings for a Bitbucket repository.
 */
export class RepositoryProviderBitbucketSettings extends $Base<"RepositoryProviderBitbucketSettings"> {
  constructor() {
    super("RepositoryProviderBitbucketSettings")
  }

  /**
   * Whether to create builds when branches are pushed.
   */
  get buildBranches(): $Field<"buildBranches", boolean> {
    return this.$_select("buildBranches") as any
  }

  /**
   * Whether to create builds for commits that are part of a Pull Request.
   */
  get buildPullRequests(): $Field<"buildPullRequests", boolean> {
    return this.$_select("buildPullRequests") as any
  }

  /**
   * Whether to create builds when tags are pushed.
   */
  get buildTags(): $Field<"buildTags", boolean> {
    return this.$_select("buildTags") as any
  }

  /**
   * A boolean to enable automatically cancelling any running builds for a branch if the branch is deleted.
   */
  get cancelDeletedBranchBuilds(): $Field<"cancelDeletedBranchBuilds", boolean | null> {
    return this.$_select("cancelDeletedBranchBuilds") as any
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }

  /**
   * Ensure that even if Build Pull Requests is disabled, all commits to the default branch will trigger a build.
   */
  get ignoreDefaultBranchPullRequests(): $Field<"ignoreDefaultBranchPullRequests", boolean> {
    return this.$_select("ignoreDefaultBranchPullRequests") as any
  }

  /**
   * Whether to update the status of commits in Bitbucket.
   */
  get publishCommitStatus(): $Field<"publishCommitStatus", boolean> {
    return this.$_select("publishCommitStatus") as any
  }

  /**
   * Whether to create a separate status for each job in a build, allowing you to see the status of each job directly in Bitbucket.
   */
  get publishCommitStatusPerStep(): $Field<"publishCommitStatusPerStep", boolean> {
    return this.$_select("publishCommitStatusPerStep") as any
  }

  /**
   * The branch filtering pattern. Only pull requests on branches matching this pattern will cause builds to be created.
   */
  get pullRequestBranchFilterConfiguration(): $Field<"pullRequestBranchFilterConfiguration", string | null> {
    return this.$_select("pullRequestBranchFilterConfiguration") as any
  }

  /**
   * Whether to limit the creation of builds to specific branches or patterns.
   */
  get pullRequestBranchFilterEnabled(): $Field<"pullRequestBranchFilterEnabled", boolean> {
    return this.$_select("pullRequestBranchFilterEnabled") as any
  }

  /**
   * Whether to skip creating a new build if a build for the commit and branch already exists.
   */
  get skipBuildsForExistingCommits(): $Field<"skipBuildsForExistingCommits", boolean | null> {
    return this.$_select("skipBuildsForExistingCommits") as any
  }

  /**
   * Whether to skip creating a new build for a pull request if an existing build for the commit and branch already exists.
   */
  get skipPullRequestBuildsForExistingCommits(): $Field<"skipPullRequestBuildsForExistingCommits", boolean> {
    return this.$_select("skipPullRequestBuildsForExistingCommits") as any
  }
}

/**
 * A pipeline's repository is being provided by Codebase
 */
export class RepositoryProviderCodebase extends $Base<"RepositoryProviderCodebase"> {
  constructor() {
    super("RepositoryProviderCodebase")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderCodebaseSettings>>(
    selectorFn: (s: RepositoryProviderCodebaseSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderCodebaseSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Settings for a Codebase repository.
 */
export class RepositoryProviderCodebaseSettings extends $Base<"RepositoryProviderCodebaseSettings"> {
  constructor() {
    super("RepositoryProviderCodebaseSettings")
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

/**
 * Settings for a GitHub Enterprise repository.
 */
export class RepositoryProviderGitHubEnterpriseSettings extends $Base<"RepositoryProviderGitHubEnterpriseSettings"> {
  constructor() {
    super("RepositoryProviderGitHubEnterpriseSettings")
  }

  /**
   * Whether to create builds when branches are pushed.
   */
  get buildBranches(): $Field<"buildBranches", boolean> {
    return this.$_select("buildBranches") as any
  }

  /**
   * Whether to create builds for pull requests when the base branch is changed.
   */
  get buildPullRequestBaseBranchChanged(): $Field<"buildPullRequestBaseBranchChanged", boolean> {
    return this.$_select("buildPullRequestBaseBranchChanged") as any
  }

  /**
   * Whether to create builds for pull requests from third-party forks.
   */
  get buildPullRequestForks(): $Field<"buildPullRequestForks", boolean> {
    return this.$_select("buildPullRequestForks") as any
  }

  /**
   * Whether to create builds for pull requests when labels are added or removed.
   */
  get buildPullRequestLabelsChanged(): $Field<"buildPullRequestLabelsChanged", boolean> {
    return this.$_select("buildPullRequestLabelsChanged") as any
  }

  /**
   * Whether to create builds for pull requests that are ready for review.
   */
  get buildPullRequestReadyForReview(): $Field<"buildPullRequestReadyForReview", boolean> {
    return this.$_select("buildPullRequestReadyForReview") as any
  }

  /**
   * Whether to create builds for commits that are part of a Pull Request.
   */
  get buildPullRequests(): $Field<"buildPullRequests", boolean> {
    return this.$_select("buildPullRequests") as any
  }

  /**
   * Whether to create builds when tags are pushed.
   */
  get buildTags(): $Field<"buildTags", boolean> {
    return this.$_select("buildTags") as any
  }

  /**
   * A boolean to enable automatically cancelling any running builds for a branch if the branch is deleted.
   */
  get cancelDeletedBranchBuilds(): $Field<"cancelDeletedBranchBuilds", boolean> {
    return this.$_select("cancelDeletedBranchBuilds") as any
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }

  /**
   * Ensure that even if Build Pull Requests is disabled, all commits to the default branch will trigger a build.
   */
  get ignoreDefaultBranchPullRequests(): $Field<"ignoreDefaultBranchPullRequests", boolean> {
    return this.$_select("ignoreDefaultBranchPullRequests") as any
  }

  /**
   * Prefix branch names for third-party fork builds to ensure they don't trigger branch conditions. For example, the main branch from some-user will become some-user:main.
   */
  get prefixPullRequestForkBranchNames(): $Field<"prefixPullRequestForkBranchNames", boolean> {
    return this.$_select("prefixPullRequestForkBranchNames") as any
  }

  /**
   * The status to use for blocked builds. Pending can be used with required status checks to prevent merging pull requests with blocked builds.
   */
  get publishBlockedAsPending(): $Field<"publishBlockedAsPending", boolean> {
    return this.$_select("publishBlockedAsPending") as any
  }

  /**
   * Whether to update the status of commits in Bitbucket or GitHub.
   */
  get publishCommitStatus(): $Field<"publishCommitStatus", boolean> {
    return this.$_select("publishCommitStatus") as any
  }

  /**
   * Whether to create a separate status for each job in a build, allowing you to see the status of each job directly in GitHub.
   */
  get publishCommitStatusPerStep(): $Field<"publishCommitStatusPerStep", boolean> {
    return this.$_select("publishCommitStatusPerStep") as any
  }

  /**
   * The branch filtering pattern. Only pull requests on branches matching this pattern will cause builds to be created.
   */
  get pullRequestBranchFilterConfiguration(): $Field<"pullRequestBranchFilterConfiguration", string | null> {
    return this.$_select("pullRequestBranchFilterConfiguration") as any
  }

  /**
   * Whether to limit the creation of builds to specific branches or patterns.
   */
  get pullRequestBranchFilterEnabled(): $Field<"pullRequestBranchFilterEnabled", boolean> {
    return this.$_select("pullRequestBranchFilterEnabled") as any
  }

  /**
   * Whether to create a separate status for pull request builds, allowing you to require a passing pull request build in your required status checks in GitHub.
   */
  get separatePullRequestStatuses(): $Field<"separatePullRequestStatuses", boolean> {
    return this.$_select("separatePullRequestStatuses") as any
  }

  /**
   * Whether to skip creating a new build if a build for the commit and branch already exists.
   */
  get skipBuildsForExistingCommits(): $Field<"skipBuildsForExistingCommits", boolean> {
    return this.$_select("skipBuildsForExistingCommits") as any
  }

  /**
   * Whether to skip creating a new build for a pull request if an existing build for the commit and branch already exists.
   */
  get skipPullRequestBuildsForExistingCommits(): $Field<"skipPullRequestBuildsForExistingCommits", boolean> {
    return this.$_select("skipPullRequestBuildsForExistingCommits") as any
  }

  /**
   * What type of event to trigger builds on.
   */
  get triggerMode(): $Field<"triggerMode", string> {
    return this.$_select("triggerMode") as any
  }
}

/**
 * Settings for a GitHub repository.
 */
export class RepositoryProviderGitHubSettings extends $Base<"RepositoryProviderGitHubSettings"> {
  constructor() {
    super("RepositoryProviderGitHubSettings")
  }

  /**
   * Whether to create builds when branches are pushed.
   */
  get buildBranches(): $Field<"buildBranches", boolean> {
    return this.$_select("buildBranches") as any
  }

  /**
   * Whether to create builds for pull requests when the base branch is changed.
   */
  get buildPullRequestBaseBranchChanged(): $Field<"buildPullRequestBaseBranchChanged", boolean> {
    return this.$_select("buildPullRequestBaseBranchChanged") as any
  }

  /**
   * Whether to create builds for pull requests from third-party forks.
   */
  get buildPullRequestForks(): $Field<"buildPullRequestForks", boolean> {
    return this.$_select("buildPullRequestForks") as any
  }

  /**
   * Whether to create builds for pull requests when labels are added or removed.
   */
  get buildPullRequestLabelsChanged(): $Field<"buildPullRequestLabelsChanged", boolean> {
    return this.$_select("buildPullRequestLabelsChanged") as any
  }

  /**
   * Whether to create builds for pull requests that are ready for review.
   */
  get buildPullRequestReadyForReview(): $Field<"buildPullRequestReadyForReview", boolean> {
    return this.$_select("buildPullRequestReadyForReview") as any
  }

  /**
   * Whether to create builds for commits that are part of a Pull Request.
   */
  get buildPullRequests(): $Field<"buildPullRequests", boolean> {
    return this.$_select("buildPullRequests") as any
  }

  /**
   * Whether to create builds when tags are pushed.
   */
  get buildTags(): $Field<"buildTags", boolean> {
    return this.$_select("buildTags") as any
  }

  /**
   * A boolean to enable automatically cancelling any running builds for a branch if the branch is deleted.
   */
  get cancelDeletedBranchBuilds(): $Field<"cancelDeletedBranchBuilds", boolean> {
    return this.$_select("cancelDeletedBranchBuilds") as any
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }

  /**
   * Ensure that even if Build Pull Requests is disabled, all commits to the default branch will trigger a build.
   */
  get ignoreDefaultBranchPullRequests(): $Field<"ignoreDefaultBranchPullRequests", boolean> {
    return this.$_select("ignoreDefaultBranchPullRequests") as any
  }

  /**
   * Prefix branch names for third-party fork builds to ensure they don't trigger branch conditions. For example, the main branch from some-user will become some-user:main.
   */
  get prefixPullRequestForkBranchNames(): $Field<"prefixPullRequestForkBranchNames", boolean> {
    return this.$_select("prefixPullRequestForkBranchNames") as any
  }

  /**
   * The status to use for blocked builds. Pending can be used with required status checks to prevent merging pull requests with blocked builds.
   */
  get publishBlockedAsPending(): $Field<"publishBlockedAsPending", boolean> {
    return this.$_select("publishBlockedAsPending") as any
  }

  /**
   * Whether to update the status of commits in Bitbucket or GitHub.
   */
  get publishCommitStatus(): $Field<"publishCommitStatus", boolean> {
    return this.$_select("publishCommitStatus") as any
  }

  /**
   * Whether to create a separate status for each job in a build, allowing you to see the status of each job directly in GitHub.
   */
  get publishCommitStatusPerStep(): $Field<"publishCommitStatusPerStep", boolean> {
    return this.$_select("publishCommitStatusPerStep") as any
  }

  /**
   * The branch filtering pattern. Only pull requests on branches matching this pattern will cause builds to be created.
   */
  get pullRequestBranchFilterConfiguration(): $Field<"pullRequestBranchFilterConfiguration", string | null> {
    return this.$_select("pullRequestBranchFilterConfiguration") as any
  }

  /**
   * Whether to limit the creation of builds to specific branches or patterns.
   */
  get pullRequestBranchFilterEnabled(): $Field<"pullRequestBranchFilterEnabled", boolean> {
    return this.$_select("pullRequestBranchFilterEnabled") as any
  }

  /**
   * Whether to create a separate status for pull request builds, allowing you to require a passing pull request build in your required status checks in GitHub.
   */
  get separatePullRequestStatuses(): $Field<"separatePullRequestStatuses", boolean> {
    return this.$_select("separatePullRequestStatuses") as any
  }

  /**
   * Whether to skip creating a new build if a build for the commit and branch already exists.
   */
  get skipBuildsForExistingCommits(): $Field<"skipBuildsForExistingCommits", boolean> {
    return this.$_select("skipBuildsForExistingCommits") as any
  }

  /**
   * Whether to skip creating a new build for a pull request if an existing build for the commit and branch already exists.
   */
  get skipPullRequestBuildsForExistingCommits(): $Field<"skipPullRequestBuildsForExistingCommits", boolean> {
    return this.$_select("skipPullRequestBuildsForExistingCommits") as any
  }

  /**
   * What type of event to trigger builds on.
   */
  get triggerMode(): $Field<"triggerMode", string> {
    return this.$_select("triggerMode") as any
  }
}

/**
 * A pipeline's repository is being provided by GitHub
 */
export class RepositoryProviderGithub extends $Base<"RepositoryProviderGithub"> {
  constructor() {
    super("RepositoryProviderGithub")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderGitHubSettings>>(
    selectorFn: (s: RepositoryProviderGitHubSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderGitHubSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * A pipeline's repository is being provided by GitHub Enterprise
 */
export class RepositoryProviderGithubEnterprise extends $Base<"RepositoryProviderGithubEnterprise"> {
  constructor() {
    super("RepositoryProviderGithubEnterprise")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderGitHubEnterpriseSettings>>(
    selectorFn: (s: RepositoryProviderGitHubEnterpriseSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderGitHubEnterpriseSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * A pipeline's repository is being provided by GitLab
 */
export class RepositoryProviderGitlab extends $Base<"RepositoryProviderGitlab"> {
  constructor() {
    super("RepositoryProviderGitlab")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderGitlabSettings>>(
    selectorFn: (s: RepositoryProviderGitlabSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderGitlabSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Deprecated: Use RepositoryProviderGitlabEnterpriseType instead. This type represented GitLab Community Edition.
 */
export class RepositoryProviderGitlabCommunity extends $Base<"RepositoryProviderGitlabCommunity"> {
  constructor() {
    super("RepositoryProviderGitlabCommunity")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderGitlabSettings>>(
    selectorFn: (s: RepositoryProviderGitlabSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderGitlabSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * A pipeline's repository is being provided by a GitLab Self-Managed instance.
 */
export class RepositoryProviderGitlabEnterprise extends $Base<"RepositoryProviderGitlabEnterprise"> {
  constructor() {
    super("RepositoryProviderGitlabEnterprise")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderGitlabSettings>>(
    selectorFn: (s: RepositoryProviderGitlabSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderGitlabSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Settings for a GitLab repository.
 */
export class RepositoryProviderGitlabSettings extends $Base<"RepositoryProviderGitlabSettings"> {
  constructor() {
    super("RepositoryProviderGitlabSettings")
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

export class RepositoryProviderSettings extends $Interface<
  {
    RepositoryProviderBeanstalkSettings: RepositoryProviderBeanstalkSettings
    RepositoryProviderBitbucketServerSettings: RepositoryProviderBitbucketServerSettings
    RepositoryProviderBitbucketSettings: RepositoryProviderBitbucketSettings
    RepositoryProviderCodebaseSettings: RepositoryProviderCodebaseSettings
    RepositoryProviderGitHubEnterpriseSettings: RepositoryProviderGitHubEnterpriseSettings
    RepositoryProviderGitHubSettings: RepositoryProviderGitHubSettings
    RepositoryProviderGitlabSettings: RepositoryProviderGitlabSettings
    RepositoryProviderUnknownSettings: RepositoryProviderUnknownSettings
  },
  "RepositoryProviderSettings"
> {
  constructor() {
    super({
      RepositoryProviderBeanstalkSettings: RepositoryProviderBeanstalkSettings,
      RepositoryProviderBitbucketServerSettings: RepositoryProviderBitbucketServerSettings,
      RepositoryProviderBitbucketSettings: RepositoryProviderBitbucketSettings,
      RepositoryProviderCodebaseSettings: RepositoryProviderCodebaseSettings,
      RepositoryProviderGitHubEnterpriseSettings: RepositoryProviderGitHubEnterpriseSettings,
      RepositoryProviderGitHubSettings: RepositoryProviderGitHubSettings,
      RepositoryProviderGitlabSettings: RepositoryProviderGitlabSettings,
      RepositoryProviderUnknownSettings: RepositoryProviderUnknownSettings,
    }, "RepositoryProviderSettings")
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

/**
 * A pipeline's repository is being provided by a service unknown to Buildkite
 */
export class RepositoryProviderUnknown extends $Base<"RepositoryProviderUnknown"> {
  constructor() {
    super("RepositoryProviderUnknown")
  }

  /**
   * The name of the provider
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The repository’s provider settings
   */
  settings<Sel extends Selection<RepositoryProviderUnknownSettings>>(
    selectorFn: (s: RepositoryProviderUnknownSettings) => [...Sel],
  ): $Field<"settings", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RepositoryProviderUnknownSettings()),
    }
    return this.$_select("settings", options as any) as any
  }

  /**
   * This URL to the provider’s web interface
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The URL to use when setting up webhooks from the provider to trigger Buildkite builds
   */
  get webhookUrl(): $Field<"webhookUrl", string | null> {
    return this.$_select("webhookUrl") as any
  }
}

/**
 * Settings for a repository provided by service unknown to Buildkite
 */
export class RepositoryProviderUnknownSettings extends $Base<"RepositoryProviderUnknownSettings"> {
  constructor() {
    super("RepositoryProviderUnknownSettings")
  }

  /**
   * The conditions under which this pipeline will trigger a build.
   */
  get filterCondition(): $Field<"filterCondition", string | null> {
    return this.$_select("filterCondition") as any
  }

  /**
   * Whether the filter is enabled
   */
  get filterEnabled(): $Field<"filterEnabled", boolean | null> {
    return this.$_select("filterEnabled") as any
  }
}

/**
 * API tokens with access to this organization will be automatically revoked after this many days of inactivity.
 */
export enum RevokeInactiveTokenPeriod {
  /**
   * Revoke organization access from API tokens after 30 days of inactivity
   */
  DAYS_30 = "DAYS_30",

  /**
   * Revoke organization access from API tokens after 60 days of inactivity
   */
  DAYS_60 = "DAYS_60",

  /**
   * Revoke organization access from API tokens after 90 days of inactivity
   */
  DAYS_90 = "DAYS_90",

  /**
   * Revoke organization access from API tokens after 180 days of inactivity
   */
  DAYS_180 = "DAYS_180",

  /**
   * Revoke organization access from API tokens after 365 days of inactivity
   */
  DAYS_365 = "DAYS_365",

  /**
   * Never revoke organization access from inactive API tokens
   */
  NEVER = "NEVER",
}

export class Rule extends $Base<"Rule"> {
  constructor() {
    super("Rule")
  }

  /**
   * Action for the rule
   */
  get action(): $Field<"action", RuleAction | null> {
    return this.$_select("action") as any
  }

  /**
   * User who created the rule
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * Description of the rule
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * A formatted JSON document of the Rule
   */
  get document(): $Field<"document", string | null> {
    return this.$_select("document") as any
  }

  /**
   * Effect for the rule
   */
  get effect(): $Field<"effect", RuleEffect | null> {
    return this.$_select("effect") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * The source for the rule
   */
  source<Sel extends Selection<RuleSource>>(
    selectorFn: (s: RuleSource) => [...Sel],
  ): $Field<"source", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RuleSource()),
    }
    return this.$_select("source", options as any) as any
  }

  /**
   * Source type for the rule
   */
  get sourceType(): $Field<"sourceType", RuleSourceType | null> {
    return this.$_select("sourceType") as any
  }

  /**
   * The target for the rule
   */
  target<Sel extends Selection<RuleTarget>>(
    selectorFn: (s: RuleTarget) => [...Sel],
  ): $Field<"target", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RuleTarget()),
    }
    return this.$_select("target", options as any) as any
  }

  /**
   * Target type for the rule
   */
  get targetType(): $Field<"targetType", RuleTargetType | null> {
    return this.$_select("targetType") as any
  }

  /**
   * The type of rule
   */
  get type(): $Field<"type", string> {
    return this.$_select("type") as any
  }

  /**
   * The public UUID for the rule
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The action a rule enforces
 */
export enum RuleAction {
  /**
   * Trigger build
   */
  TRIGGER_BUILD = "TRIGGER_BUILD",

  /**
   * Artifacts read
   */
  ARTIFACTS_READ = "ARTIFACTS_READ",
}

export class RuleConnection extends $Base<"RuleConnection"> {
  constructor() {
    super("RuleConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<RuleEdge>>(
    selectorFn: (s: RuleEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RuleEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of RuleCreate
 */
export type RuleCreateInput = {
  clientMutationId?: string | null
  description?: string | null
  organizationId: string
  type: string
  value: CustomScalar<JSON>
}

/**
 * Autogenerated return type of RuleCreate.
 */
export class RuleCreatePayload extends $Base<"RuleCreatePayload"> {
  constructor() {
    super("RuleCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  rule<Sel extends Selection<Rule>>(
    selectorFn: (s: Rule) => [...Sel],
  ): $Field<"rule", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Rule()),
    }
    return this.$_select("rule", options as any) as any
  }
}

/**
 * Autogenerated input type of RuleDelete
 */
export type RuleDeleteInput = {
  clientMutationId?: string | null
  id: string
  organizationId: string
}

/**
 * Autogenerated return type of RuleDelete.
 */
export class RuleDeletePayload extends $Base<"RuleDeletePayload"> {
  constructor() {
    super("RuleDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedRuleId(): $Field<"deletedRuleId", string> {
    return this.$_select("deletedRuleId") as any
  }
}

export class RuleEdge extends $Base<"RuleEdge"> {
  constructor() {
    super("RuleEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Rule>>(
    selectorFn: (s: Rule) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Rule()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The effect a rule has
 */
export enum RuleEffect {
  /**
   * Allow
   */
  ALLOW = "ALLOW",
}

/**
 * The different orders you can sort rules by
 */
export enum RuleOrder {
  /**
   * Order by the most recently created rules first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Kinds of sources for a rule
 */
export class RuleSource extends $Union<{ Pipeline: Pipeline; Node: Node }, "RuleSource"> {
  constructor() {
    super({ Pipeline: Pipeline, Node: Node }, "RuleSource")
  }
}

/**
 * The source type for a rule
 */
export enum RuleSourceType {
  /**
   * Pipeline
   */
  PIPELINE = "PIPELINE",
}

/**
 * Kinds of targets for a rule
 */
export class RuleTarget extends $Union<{ Pipeline: Pipeline; Node: Node }, "RuleTarget"> {
  constructor() {
    super({ Pipeline: Pipeline, Node: Node }, "RuleTarget")
  }
}

/**
 * The target type for a rule
 */
export enum RuleTargetType {
  /**
   * Pipeline
   */
  PIPELINE = "PIPELINE",
}

/**
 * Autogenerated input type of RuleUpdate
 */
export type RuleUpdateInput = {
  clientMutationId?: string | null
  description?: string | null
  id: string
  organizationId: string
  value: CustomScalar<JSON>
}

/**
 * Autogenerated return type of RuleUpdate.
 */
export class RuleUpdatePayload extends $Base<"RuleUpdatePayload"> {
  constructor() {
    super("RuleUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  rule<Sel extends Selection<Rule>>(
    selectorFn: (s: Rule) => [...Sel],
  ): $Field<"rule", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Rule()),
    }
    return this.$_select("rule", options as any) as any
  }
}

export class SCMPipelineSettings extends $Base<"SCMPipelineSettings"> {
  constructor() {
    super("SCMPipelineSettings")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

export class SCMRepositoryHost extends $Base<"SCMRepositoryHost"> {
  constructor() {
    super("SCMRepositoryHost")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

export class SCMService extends $Base<"SCMService"> {
  constructor() {
    super("SCMService")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

export class SSOAuthorization extends $Base<"SSOAuthorization"> {
  constructor() {
    super("SSOAuthorization")
  }

  /**
   * The time when this SSO Authorization was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The time when this SSO Authorization was expired
   */
  get expiredAt(): $Field<"expiredAt", CustomScalar<DateTime> | null> {
    return this.$_select("expiredAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Details around the identity provided by the SSO provider
   */
  identity<Sel extends Selection<SSOAuthorizationIdentity>>(
    selectorFn: (s: SSOAuthorizationIdentity) => [...Sel],
  ): $Field<"identity", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOAuthorizationIdentity()),
    }
    return this.$_select("identity", options as any) as any
  }

  /**
   * The time when this SSO Authorization was manually revoked
   */
  get revokedAt(): $Field<"revokedAt", CustomScalar<DateTime> | null> {
    return this.$_select("revokedAt") as any
  }

  /**
   * The SSO provider associated with this authorization
   */
  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }

  /**
   * The current state of the SSO Authorization
   */
  get state(): $Field<"state", SSOAuthorizationState> {
    return this.$_select("state") as any
  }

  /**
   * The user associated with this authorization
   */
  user<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"user", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("user", options as any) as any
  }

  /**
   * The time when this SSO Authorization was destroyed because the user logged out
   */
  get userSessionDestroyedAt(): $Field<"userSessionDestroyedAt", CustomScalar<DateTime> | null> {
    return this.$_select("userSessionDestroyedAt") as any
  }

  /**
   * The public UUID for this SSO authorization
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class SSOAuthorizationConnection extends $Base<"SSOAuthorizationConnection"> {
  constructor() {
    super("SSOAuthorizationConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<SSOAuthorizationEdge>>(
    selectorFn: (s: SSOAuthorizationEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOAuthorizationEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class SSOAuthorizationEdge extends $Base<"SSOAuthorizationEdge"> {
  constructor() {
    super("SSOAuthorizationEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<SSOAuthorization>>(
    selectorFn: (s: SSOAuthorization) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOAuthorization()),
    }
    return this.$_select("node", options as any) as any
  }
}

export class SSOAuthorizationIdentity extends $Base<"SSOAuthorizationIdentity"> {
  constructor() {
    super("SSOAuthorizationIdentity")
  }

  /**
   * The avatar URL provided in this identity
   */
  get avatarURL(): $Field<"avatarURL", string | null> {
    return this.$_select("avatarURL") as any
  }

  /**
   * The email addresses provided in this identity
   */
  get email(): $Field<"email", string | null> {
    return this.$_select("email") as any
  }

  /**
   * The name provided in this identity
   */
  get name(): $Field<"name", string | null> {
    return this.$_select("name") as any
  }

  /**
   * The identifier provided in this identity
   */
  get uid(): $Field<"uid", string | null> {
    return this.$_select("uid") as any
  }
}

/**
 * All the possible states an SSO Authorization
 */
export enum SSOAuthorizationState {
  /**
   * The authorization has been verified and is in use
   */
  VERIFIED = "VERIFIED",

  /**
   * The authorization was verified but has since been destroyed as the user logged out of that session
   */
  VERIFIED_USER_SESSION_DESTROYED = "VERIFIED_USER_SESSION_DESTROYED",

  /**
   * The authorization was verified but has since been manually revoked
   */
  VERIFIED_REVOKED = "VERIFIED_REVOKED",

  /**
   * The authorization was verified but has since expired
   */
  VERIFIED_EXPIRED = "VERIFIED_EXPIRED",
}

export class SSOProvider extends $Interface<
  {
    SSOProviderGitHubApp: SSOProviderGitHubApp
    SSOProviderGoogleGSuite: SSOProviderGoogleGSuite
    SSOProviderSAML: SSOProviderSAML
  },
  "SSOProvider"
> {
  constructor() {
    super({
      SSOProviderGitHubApp: SSOProviderGitHubApp,
      SSOProviderGoogleGSuite: SSOProviderGoogleGSuite,
      SSOProviderSAML: SSOProviderSAML,
    }, "SSOProvider")
  }

  /**
   * The time when this SSO Provider was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this SSO Provider
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The time when this SSO Provider was disabled
   */
  get disabledAt(): $Field<"disabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("disabledAt") as any
  }

  /**
   * The user that disabled this SSO Provider
   */
  disabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"disabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("disabledBy", options as any) as any
  }

  /**
   * The reason this SSO Provider was disabled
   */
  get disabledReason(): $Field<"disabledReason", string | null> {
    return this.$_select("disabledReason") as any
  }

  /**
   * An email domain whose addresses should be offered this SSO Provider during login.
   */
  get emailDomain(): $Field<"emailDomain", string | null> {
    return this.$_select("emailDomain") as any
  }

  get emailDomainVerificationAddress(): $Field<"emailDomainVerificationAddress", string | null> {
    return this.$_select("emailDomainVerificationAddress") as any
  }

  get emailDomainVerifiedAt(): $Field<"emailDomainVerifiedAt", CustomScalar<DateTime> | null> {
    return this.$_select("emailDomainVerifiedAt") as any
  }

  /**
   * The time when this SSO Provider was enabled
   */
  get enabledAt(): $Field<"enabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("enabledAt") as any
  }

  /**
   * The user that enabled this SSO Provider
   */
  enabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"enabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("enabledBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * An extra message that can be added the Authorization screen of an SSO Provider
   */
  get note(): $Field<"note", string | null> {
    return this.$_select("note") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Defaults to false. If true, users are required to re-authenticate when their IP address changes.
   */
  get pinSessionToIpAddress(): $Field<"pinSessionToIpAddress", boolean | null> {
    return this.$_select("pinSessionToIpAddress") as any
  }

  /**
   * How long a session should last before requiring re-authorization. A `null` value indicates an infinite session.
   */
  get sessionDurationInHours(): $Field<"sessionDurationInHours", number | null> {
    return this.$_select("sessionDurationInHours") as any
  }

  /**
   * The current state of the SSO Provider
   */
  get state(): $Field<"state", SSOProviderStates> {
    return this.$_select("state") as any
  }

  /**
   * Whether the SSO Provider requires a test authorization. If true, the provider can not yet be activated.
   */
  get testAuthorizationRequired(): $Field<"testAuthorizationRequired", boolean | null> {
    return this.$_select("testAuthorizationRequired") as any
  }

  /**
   * The type of SSO Provider
   */
  get type(): $Field<"type", SSOProviderTypes> {
    return this.$_select("type") as any
  }

  /**
   * The authorization URL for this SSO Provider
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for this SSO Provider
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class SSOProviderConnection extends $Base<"SSOProviderConnection"> {
  constructor() {
    super("SSOProviderConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<SSOProviderEdge>>(
    selectorFn: (s: SSOProviderEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of SSOProviderCreate
 */
export type SSOProviderCreateInput = {
  clientMutationId?: string | null
  digestMethod?: SSOProviderSAMLXMLSecurity | null
  discloseGoogleHostedDomain?: boolean | null
  emailDomain?: string | null
  emailDomainVerificationAddress?: string | null
  githubOrganizationName?: string | null
  googleHostedDomain?: string | null
  identityProvider?: SSOProviderSAMLIdP | null
  note?: string | null
  organizationId: string
  pinSessionToIpAddress?: boolean | null
  sessionDurationInHours?: number | null
  signatureMethod?: SSOProviderSAMLRSAXMLSecurity | null
  type: SSOProviderTypes
}

/**
 * Autogenerated return type of SSOProviderCreate.
 */
export class SSOProviderCreatePayload extends $Base<"SSOProviderCreatePayload"> {
  constructor() {
    super("SSOProviderCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }

  ssoProviderEdge<Sel extends Selection<SSOProviderEdge>>(
    selectorFn: (s: SSOProviderEdge) => [...Sel],
  ): $Field<"ssoProviderEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderEdge()),
    }
    return this.$_select("ssoProviderEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of SSOProviderDelete
 */
export type SSOProviderDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of SSOProviderDelete.
 */
export class SSOProviderDeletePayload extends $Base<"SSOProviderDeletePayload"> {
  constructor() {
    super("SSOProviderDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedSSOProviderId(): $Field<"deletedSSOProviderId", string> {
    return this.$_select("deletedSSOProviderId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

/**
 * Autogenerated input type of SSOProviderDisable
 */
export type SSOProviderDisableInput = {
  clientMutationId?: string | null
  disabledReason?: string | null
  id: string
}

/**
 * Autogenerated return type of SSOProviderDisable.
 */
export class SSOProviderDisablePayload extends $Base<"SSOProviderDisablePayload"> {
  constructor() {
    super("SSOProviderDisablePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }
}

export class SSOProviderEdge extends $Base<"SSOProviderEdge"> {
  constructor() {
    super("SSOProviderEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * Autogenerated input type of SSOProviderEnable
 */
export type SSOProviderEnableInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of SSOProviderEnable.
 */
export class SSOProviderEnablePayload extends $Base<"SSOProviderEnablePayload"> {
  constructor() {
    super("SSOProviderEnablePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }
}

/**
 * Single sign-on provided by GitHub
 */
export class SSOProviderGitHubApp extends $Base<"SSOProviderGitHubApp"> {
  constructor() {
    super("SSOProviderGitHubApp")
  }

  /**
   * The time when this SSO Provider was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this SSO Provider
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The time when this SSO Provider was disabled
   */
  get disabledAt(): $Field<"disabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("disabledAt") as any
  }

  /**
   * The user that disabled this SSO Provider
   */
  disabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"disabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("disabledBy", options as any) as any
  }

  /**
   * The reason this SSO Provider was disabled
   */
  get disabledReason(): $Field<"disabledReason", string | null> {
    return this.$_select("disabledReason") as any
  }

  /**
   * An email domain whose addresses should be offered this SSO Provider during login.
   */
  get emailDomain(): $Field<"emailDomain", string | null> {
    return this.$_select("emailDomain") as any
  }

  get emailDomainVerificationAddress(): $Field<"emailDomainVerificationAddress", string | null> {
    return this.$_select("emailDomainVerificationAddress") as any
  }

  get emailDomainVerifiedAt(): $Field<"emailDomainVerifiedAt", CustomScalar<DateTime> | null> {
    return this.$_select("emailDomainVerifiedAt") as any
  }

  /**
   * The time when this SSO Provider was enabled
   */
  get enabledAt(): $Field<"enabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("enabledAt") as any
  }

  /**
   * The user that enabled this SSO Provider
   */
  enabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"enabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("enabledBy", options as any) as any
  }

  /**
   * The name of the organization on GitHub that the user must be in for an SSO authorization to be verified
   */
  get githubOrganizationName(): $Field<"githubOrganizationName", string> {
    return this.$_select("githubOrganizationName") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * An extra message that can be added the Authorization screen of an SSO Provider
   */
  get note(): $Field<"note", string | null> {
    return this.$_select("note") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Defaults to false. If true, users are required to re-authenticate when their IP address changes.
   */
  get pinSessionToIpAddress(): $Field<"pinSessionToIpAddress", boolean | null> {
    return this.$_select("pinSessionToIpAddress") as any
  }

  /**
   * How long a session should last before requiring re-authorization. A `null` value indicates an infinite session.
   */
  get sessionDurationInHours(): $Field<"sessionDurationInHours", number | null> {
    return this.$_select("sessionDurationInHours") as any
  }

  /**
   * The current state of the SSO Provider
   */
  get state(): $Field<"state", SSOProviderStates> {
    return this.$_select("state") as any
  }

  /**
   * Whether the SSO Provider requires a test authorization. If true, the provider can not yet be activated.
   */
  get testAuthorizationRequired(): $Field<"testAuthorizationRequired", boolean | null> {
    return this.$_select("testAuthorizationRequired") as any
  }

  /**
   * The type of SSO Provider
   */
  get type(): $Field<"type", SSOProviderTypes> {
    return this.$_select("type") as any
  }

  /**
   * The authorization URL for this SSO Provider
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for this SSO Provider
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Single sign-on provided by Google
 */
export class SSOProviderGoogleGSuite extends $Base<"SSOProviderGoogleGSuite"> {
  constructor() {
    super("SSOProviderGoogleGSuite")
  }

  /**
   * The time when this SSO Provider was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this SSO Provider
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The time when this SSO Provider was disabled
   */
  get disabledAt(): $Field<"disabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("disabledAt") as any
  }

  /**
   * The user that disabled this SSO Provider
   */
  disabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"disabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("disabledBy", options as any) as any
  }

  /**
   * The reason this SSO Provider was disabled
   */
  get disabledReason(): $Field<"disabledReason", string | null> {
    return this.$_select("disabledReason") as any
  }

  /**
   * Whether or not the hosted domain should be presented to the user during SSO
   */
  get discloseGoogleHostedDomain(): $Field<"discloseGoogleHostedDomain", boolean> {
    return this.$_select("discloseGoogleHostedDomain") as any
  }

  /**
   * An email domain whose addresses should be offered this SSO Provider during login.
   */
  get emailDomain(): $Field<"emailDomain", string | null> {
    return this.$_select("emailDomain") as any
  }

  get emailDomainVerificationAddress(): $Field<"emailDomainVerificationAddress", string | null> {
    return this.$_select("emailDomainVerificationAddress") as any
  }

  get emailDomainVerifiedAt(): $Field<"emailDomainVerifiedAt", CustomScalar<DateTime> | null> {
    return this.$_select("emailDomainVerifiedAt") as any
  }

  /**
   * The time when this SSO Provider was enabled
   */
  get enabledAt(): $Field<"enabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("enabledAt") as any
  }

  /**
   * The user that enabled this SSO Provider
   */
  enabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"enabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("enabledBy", options as any) as any
  }

  /**
   * The Google hosted domain that is required to be present in OAuth
   */
  get googleHostedDomain(): $Field<"googleHostedDomain", string> {
    return this.$_select("googleHostedDomain") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * An extra message that can be added the Authorization screen of an SSO Provider
   */
  get note(): $Field<"note", string | null> {
    return this.$_select("note") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Defaults to false. If true, users are required to re-authenticate when their IP address changes.
   */
  get pinSessionToIpAddress(): $Field<"pinSessionToIpAddress", boolean | null> {
    return this.$_select("pinSessionToIpAddress") as any
  }

  /**
   * How long a session should last before requiring re-authorization. A `null` value indicates an infinite session.
   */
  get sessionDurationInHours(): $Field<"sessionDurationInHours", number | null> {
    return this.$_select("sessionDurationInHours") as any
  }

  /**
   * The current state of the SSO Provider
   */
  get state(): $Field<"state", SSOProviderStates> {
    return this.$_select("state") as any
  }

  /**
   * Whether the SSO Provider requires a test authorization. If true, the provider can not yet be activated.
   */
  get testAuthorizationRequired(): $Field<"testAuthorizationRequired", boolean | null> {
    return this.$_select("testAuthorizationRequired") as any
  }

  /**
   * The type of SSO Provider
   */
  get type(): $Field<"type", SSOProviderTypes> {
    return this.$_select("type") as any
  }

  /**
   * The authorization URL for this SSO Provider
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for this SSO Provider
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * Single sign-on provided via SAML
 */
export class SSOProviderSAML extends $Base<"SSOProviderSAML"> {
  constructor() {
    super("SSOProviderSAML")
  }

  /**
   * The time when this SSO Provider was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this SSO Provider
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * The algorithm used to calculate the digest value during a SAML exchange
   */
  get digestMethod(): $Field<"digestMethod", SSOProviderSAMLXMLSecurity> {
    return this.$_select("digestMethod") as any
  }

  /**
   * The time when this SSO Provider was disabled
   */
  get disabledAt(): $Field<"disabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("disabledAt") as any
  }

  /**
   * The user that disabled this SSO Provider
   */
  disabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"disabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("disabledBy", options as any) as any
  }

  /**
   * The reason this SSO Provider was disabled
   */
  get disabledReason(): $Field<"disabledReason", string | null> {
    return this.$_select("disabledReason") as any
  }

  /**
   * An email domain whose addresses should be offered this SSO Provider during login.
   */
  get emailDomain(): $Field<"emailDomain", string | null> {
    return this.$_select("emailDomain") as any
  }

  get emailDomainVerificationAddress(): $Field<"emailDomainVerificationAddress", string | null> {
    return this.$_select("emailDomainVerificationAddress") as any
  }

  get emailDomainVerifiedAt(): $Field<"emailDomainVerifiedAt", CustomScalar<DateTime> | null> {
    return this.$_select("emailDomainVerifiedAt") as any
  }

  /**
   * The time when this SSO Provider was enabled
   */
  get enabledAt(): $Field<"enabledAt", CustomScalar<DateTime> | null> {
    return this.$_select("enabledAt") as any
  }

  /**
   * The user that enabled this SSO Provider
   */
  enabledBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"enabledBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("enabledBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Information about the IdP
   */
  identityProvider<Sel extends Selection<SSOProviderSAMLIdPType>>(
    selectorFn: (s: SSOProviderSAMLIdPType) => [...Sel],
  ): $Field<"identityProvider", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderSAMLIdPType()),
    }
    return this.$_select("identityProvider", options as any) as any
  }

  /**
   * An extra message that can be added the Authorization screen of an SSO Provider
   */
  get note(): $Field<"note", string | null> {
    return this.$_select("note") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * Defaults to false. If true, users are required to re-authenticate when their IP address changes.
   */
  get pinSessionToIpAddress(): $Field<"pinSessionToIpAddress", boolean | null> {
    return this.$_select("pinSessionToIpAddress") as any
  }

  serviceProvider<Sel extends Selection<SSOProviderSAMLSPType>>(
    selectorFn: (s: SSOProviderSAMLSPType) => [...Sel],
  ): $Field<"serviceProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderSAMLSPType()),
    }
    return this.$_select("serviceProvider", options as any) as any
  }

  /**
   * How long a session should last before requiring re-authorization. A `null` value indicates an infinite session.
   */
  get sessionDurationInHours(): $Field<"sessionDurationInHours", number | null> {
    return this.$_select("sessionDurationInHours") as any
  }

  /**
   * The algorithm used to calculate the signature value during a SAML exchange
   */
  get signatureMethod(): $Field<"signatureMethod", SSOProviderSAMLRSAXMLSecurity> {
    return this.$_select("signatureMethod") as any
  }

  /**
   * The current state of the SSO Provider
   */
  get state(): $Field<"state", SSOProviderStates> {
    return this.$_select("state") as any
  }

  /**
   * Whether the SSO Provider requires a test authorization. If true, the provider can not yet be activated.
   */
  get testAuthorizationRequired(): $Field<"testAuthorizationRequired", boolean | null> {
    return this.$_select("testAuthorizationRequired") as any
  }

  /**
   * The type of SSO Provider
   */
  get type(): $Field<"type", SSOProviderTypes> {
    return this.$_select("type") as any
  }

  /**
   * The authorization URL for this SSO Provider
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  /**
   * The UUID for this SSO Provider
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export type SSOProviderSAMLIdP = {
  certificate?: string | null
  issuer?: string | null
  metadata?: SSOProviderSAMLIdPMetadata | null
  ssoURL?: string | null
}

export type SSOProviderSAMLIdPMetadata = {
  url?: string | null
  xml?: CustomScalar<XML> | null
}

/**
 * Information about the IdP for a SAML SSO Provider
 */
export class SSOProviderSAMLIdPType extends $Base<"SSOProviderSAMLIdPType"> {
  constructor() {
    super("SSOProviderSAMLIdPType")
  }

  /**
   * The certificated provided by the IdP
   */
  get certificate(): $Field<"certificate", string | null> {
    return this.$_select("certificate") as any
  }

  /**
   * The IdP Issuer value for this SSO Provider
   */
  get issuer(): $Field<"issuer", string | null> {
    return this.$_select("issuer") as any
  }

  /**
   * The metadata used to configure this SSO provider if it was provided
   */
  metadata<Sel extends Selection<SSOProviderSAMLMetadataType>>(
    selectorFn: (s: SSOProviderSAMLMetadataType) => [...Sel],
  ): $Field<"metadata", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderSAMLMetadataType()),
    }
    return this.$_select("metadata", options as any) as any
  }

  /**
   * The name of the IdP Service. Returns nil if no name can be guessed from the SSO URL
   */
  get name(): $Field<"name", string | null> {
    return this.$_select("name") as any
  }

  /**
   * The IdP SSO URL for this SSO Provider
   */
  get ssoURL(): $Field<"ssoURL", string | null> {
    return this.$_select("ssoURL") as any
  }
}

/**
 * SAML metadata used for configuration
 */
export class SSOProviderSAMLMetadataType extends $Base<"SSOProviderSAMLMetadataType"> {
  constructor() {
    super("SSOProviderSAMLMetadataType")
  }

  /**
   * The URL that this metadata can be publicly accessed at
   */
  get url(): $Field<"url", string | null> {
    return this.$_select("url") as any
  }

  /**
   * The XML for this metadata
   */
  get xml(): $Field<"xml", CustomScalar<XML> | null> {
    return this.$_select("xml") as any
  }
}

/**
 * XML RSA security algorithms used in the SAML exchange
 */
export enum SSOProviderSAMLRSAXMLSecurity {
  /**
   * http://www.w3.org/2000/09/xmldsig#rsa-sha1
   */
  RSA_SHA1 = "RSA_SHA1",

  /**
   * http://www.w3.org/2001/04/xmldsig-more#rsa-sha256
   */
  RSA_SHA256 = "RSA_SHA256",

  /**
   * http://www.w3.org/2001/04/xmldsig-more#rsa-sha384
   */
  RSA_SHA384 = "RSA_SHA384",

  /**
   * http://www.w3.org/2001/04/xmldsig-more#rsa-sha512
   */
  RSA_SHA512 = "RSA_SHA512",
}

/**
 * Information about Buildkite as a SAML Service Provider
 */
export class SSOProviderSAMLSPType extends $Base<"SSOProviderSAMLSPType"> {
  constructor() {
    super("SSOProviderSAMLSPType")
  }

  /**
   * The IdP Issuer value for this SSO Provider
   */
  get issuer(): $Field<"issuer", string | null> {
    return this.$_select("issuer") as any
  }

  /**
   * The metadata used to configure this SSO provider if it was provided
   */
  metadata<Sel extends Selection<SSOProviderSAMLMetadataType>>(
    selectorFn: (s: SSOProviderSAMLMetadataType) => [...Sel],
  ): $Field<"metadata", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProviderSAMLMetadataType()),
    }
    return this.$_select("metadata", options as any) as any
  }

  /**
   * The IdP SSO URL for this SSO Provider
   */
  get ssoURL(): $Field<"ssoURL", string | null> {
    return this.$_select("ssoURL") as any
  }
}

/**
 * XML security algorithms used in the SAML exchange
 */
export enum SSOProviderSAMLXMLSecurity {
  /**
   * http://www.w3.org/2000/09/xmldsig#sha1
   */
  SHA1 = "SHA1",

  /**
   * http://www.w3.org/2001/04/xmlenc#sha256
   */
  SHA256 = "SHA256",

  /**
   * http://www.w3.org/2001/04/xmldsig-more#sha384
   */
  SHA384 = "SHA384",

  /**
   * http://www.w3.org/2001/04/xmlenc#sha512
   */
  SHA512 = "SHA512",
}

/**
 * All the possible states an SSO Provider can be in
 */
export enum SSOProviderStates {
  /**
   * The SSO Provider has been created, but has not been enabled for use yet
   */
  CREATED = "CREATED",

  /**
   * The SSO Provider has been setup correctly and can be used by users
   */
  ENABLED = "ENABLED",

  /**
   * The SSO Provider has been disabled and can't be used directly
   */
  DISABLED = "DISABLED",
}

/**
 * All the possible SSO Provider types
 */
export enum SSOProviderTypes {
  /**
   * An SSO Provider configured to use SAML
   */
  SAML = "SAML",

  /**
   * A SSO Provider configured to use Google G Suite for authorization
   */
  GOOGLE_GSUITE = "GOOGLE_GSUITE",

  /**
   * A SSO Provider configured to use a GitHub App for authorization
   */
  GITHUB_APP = "GITHUB_APP",
}

/**
 * Autogenerated input type of SSOProviderUpdate
 */
export type SSOProviderUpdateInput = {
  clientMutationId?: string | null
  digestMethod?: SSOProviderSAMLXMLSecurity | null
  discloseGoogleHostedDomain?: boolean | null
  emailDomain?: string | null
  emailDomainVerificationAddress?: string | null
  githubOrganizationName?: string | null
  googleHostedDomain?: string | null
  id: string
  identityProvider?: SSOProviderSAMLIdP | null
  note?: string | null
  pinSessionToIpAddress?: boolean | null
  sessionDurationInHours?: number | null
  signatureMethod?: SSOProviderSAMLRSAXMLSecurity | null
}

/**
 * Autogenerated return type of SSOProviderUpdate.
 */
export class SSOProviderUpdatePayload extends $Base<"SSOProviderUpdatePayload"> {
  constructor() {
    super("SSOProviderUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  ssoProvider<Sel extends Selection<SSOProvider>>(
    selectorFn: (s: SSOProvider) => [...Sel],
  ): $Field<"ssoProvider", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SSOProvider()),
    }
    return this.$_select("ssoProvider", options as any) as any
  }
}

/**
 * A secret hosted by Buildkite. This does not contain the secret value or encrypted material.
 */
export class Secret extends $Base<"Secret"> {
  constructor() {
    super("Secret")
  }

  /**
   * The cluster that the secret belongs to
   */
  cluster<Sel extends Selection<Cluster>>(
    selectorFn: (s: Cluster) => [...Sel],
  ): $Field<"cluster", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Cluster()),
    }
    return this.$_select("cluster", options as any) as any
  }

  /**
   * The time this secret was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * A description about what this secret is used for
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  /**
   * The time this secret was destroyed
   */
  get destroyedAt(): $Field<"destroyedAt", CustomScalar<DateTime> | null> {
    return this.$_select("destroyedAt") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The key value used to name the secret
   */
  get key(): $Field<"key", string> {
    return this.$_select("key") as any
  }

  /**
   * The organization that the secret belongs to
   */
  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * The time this secret was updated
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime> | null> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The public UUID for the secret
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class Step extends $Interface<
  { StepCommand: StepCommand; StepInput: StepInput; StepTrigger: StepTrigger; StepWait: StepWait },
  "Step"
> {
  constructor() {
    super({ StepCommand: StepCommand, StepInput: StepInput, StepTrigger: StepTrigger, StepWait: StepWait }, "Step")
  }

  /**
   * The conditional evaluated for this step
   */
  get conditional(): $Field<"conditional", string | null> {
    return this.$_select("conditional") as any
  }

  /**
   * Dependencies of this job
   */
  dependencies<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<DependencyConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  dependencies<Sel extends Selection<DependencyConnection>>(
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel>>
  dependencies(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new DependencyConnection()),
    }
    return this.$_select("dependencies", options as any) as any
  }

  /**
   * The user-defined key for this step
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this step
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A step in a build that runs a command on an agent
 */
export class StepCommand extends $Base<"StepCommand"> {
  constructor() {
    super("StepCommand")
  }

  /**
   * The conditional evaluated for this step
   */
  get conditional(): $Field<"conditional", string | null> {
    return this.$_select("conditional") as any
  }

  /**
   * Dependencies of this job
   */
  dependencies<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<DependencyConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  dependencies<Sel extends Selection<DependencyConnection>>(
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel>>
  dependencies(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new DependencyConnection()),
    }
    return this.$_select("dependencies", options as any) as any
  }

  /**
   * The user-defined key for this step
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this step
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * An input step collects information from a user
 */
export class StepInput extends $Base<"StepInput"> {
  constructor() {
    super("StepInput")
  }

  /**
   * The conditional evaluated for this step
   */
  get conditional(): $Field<"conditional", string | null> {
    return this.$_select("conditional") as any
  }

  /**
   * Dependencies of this job
   */
  dependencies<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<DependencyConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  dependencies<Sel extends Selection<DependencyConnection>>(
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel>>
  dependencies(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new DependencyConnection()),
    }
    return this.$_select("dependencies", options as any) as any
  }

  /**
   * The user-defined key for this step
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this step
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A trigger step creates a build on another pipeline
 */
export class StepTrigger extends $Base<"StepTrigger"> {
  constructor() {
    super("StepTrigger")
  }

  /**
   * The conditional evaluated for this step
   */
  get conditional(): $Field<"conditional", string | null> {
    return this.$_select("conditional") as any
  }

  /**
   * Dependencies of this job
   */
  dependencies<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<DependencyConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  dependencies<Sel extends Selection<DependencyConnection>>(
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel>>
  dependencies(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new DependencyConnection()),
    }
    return this.$_select("dependencies", options as any) as any
  }

  /**
   * The user-defined key for this step
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this step
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A wait step waits for all previous steps to have successfully completed before allowing following jobs to continue
 */
export class StepWait extends $Base<"StepWait"> {
  constructor() {
    super("StepWait")
  }

  /**
   * The conditional evaluated for this step
   */
  get conditional(): $Field<"conditional", string | null> {
    return this.$_select("conditional") as any
  }

  /**
   * Dependencies of this job
   */
  dependencies<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    Sel extends Selection<DependencyConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
    }>,
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  dependencies<Sel extends Selection<DependencyConnection>>(
    selectorFn: (s: DependencyConnection) => [...Sel],
  ): $Field<"dependencies", GetOutput<Sel> | null, GetVariables<Sel>>
  dependencies(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
      },
      args,

      selection: selectorFn(new DependencyConnection()),
    }
    return this.$_select("dependencies", options as any) as any
  }

  /**
   * The user-defined key for this step
   */
  get key(): $Field<"key", string | null> {
    return this.$_select("key") as any
  }

  /**
   * The UUID for this step
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class Subscription extends $Base<"Subscription"> {
  constructor() {
    super("Subscription")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }
}

/**
 * A suite
 */
export class Suite extends $Base<"Suite"> {
  constructor() {
    super("Suite")
  }

  /**
   * The application name for the suite
   */
  get applicationName(): $Field<"applicationName", string | null> {
    return this.$_select("applicationName") as any
  }

  /**
   * The hex code for the suite navatar background color in the Test Suites page
   */
  get color(): $Field<"color", string | null> {
    return this.$_select("color") as any
  }

  /**
   * The time when the suite was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime> | null> {
    return this.$_select("createdAt") as any
  }

  /**
   * The default branch for this suite
   */
  get defaultBranch(): $Field<"defaultBranch", string | null> {
    return this.$_select("defaultBranch") as any
  }

  /**
   * The emoji that will display as a suite navatar in the Test Suites page
   */
  get emoji(): $Field<"emoji", string | null> {
    return this.$_select("emoji") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the suite
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  /**
   * The slug of the suite
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  /**
   * Teams associated with this suite
   */
  teams<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamSuiteOrder | null
    }>,
    Sel extends Selection<TeamSuiteConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamSuiteOrder | null
    }>,
    selectorFn: (s: TeamSuiteConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  teams<Sel extends Selection<TeamSuiteConnection>>(
    selectorFn: (s: TeamSuiteConnection) => [...Sel],
  ): $Field<"teams", GetOutput<Sel> | null, GetVariables<Sel>>
  teams(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        order: "TeamSuiteOrder",
      },
      args,

      selection: selectorFn(new TeamSuiteConnection()),
    }
    return this.$_select("teams", options as any) as any
  }

  /**
   * The URL for the suite
   */
  get url(): $Field<"url", string> {
    return this.$_select("url") as any
  }

  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * The access levels that can be assigned to a suite
 */
export enum SuiteAccessLevels {
  /**
   * Allows edits and reads
   */
  MANAGE_AND_READ = "MANAGE_AND_READ",

  /**
   * Read only
   */
  READ_ONLY = "READ_ONLY",
}

export class SuiteConnection extends $Base<"SuiteConnection"> {
  constructor() {
    super("SuiteConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<SuiteEdge>>(
    selectorFn: (s: SuiteEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new SuiteEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

export class SuiteEdge extends $Base<"SuiteEdge"> {
  constructor() {
    super("SuiteEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Suite>>(
    selectorFn: (s: Suite) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Suite()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort suites by
 */
export enum SuiteOrders {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created suites first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",

  /**
   * Order by relevance when searching for suites
   */
  RELEVANCE = "RELEVANCE",
}

/**
 * A TOTP configuration
 */
export class TOTP extends $Base<"TOTP"> {
  constructor() {
    super("TOTP")
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The recovery code batch associated with this TOTP configuration
   */
  recoveryCodes<Sel extends Selection<RecoveryCodeBatch>>(
    selectorFn: (s: RecoveryCodeBatch) => [...Sel],
  ): $Field<"recoveryCodes", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RecoveryCodeBatch()),
    }
    return this.$_select("recoveryCodes", options as any) as any
  }

  /**
   * Whether the TOTP configuration has been verified yet
   */
  get verified(): $Field<"verified", boolean> {
    return this.$_select("verified") as any
  }
}

/**
 * Autogenerated input type of TOTPActivate
 */
export type TOTPActivateInput = {
  clientMutationId?: string | null
  id: string
  token: string
}

/**
 * Autogenerated return type of TOTPActivate.
 */
export class TOTPActivatePayload extends $Base<"TOTPActivatePayload"> {
  constructor() {
    super("TOTPActivatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  totp<Sel extends Selection<TOTP>>(
    selectorFn: (s: TOTP) => [...Sel],
  ): $Field<"totp", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TOTP()),
    }
    return this.$_select("totp", options as any) as any
  }

  viewer<Sel extends Selection<Viewer>>(
    selectorFn: (s: Viewer) => [...Sel],
  ): $Field<"viewer", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Viewer()),
    }
    return this.$_select("viewer", options as any) as any
  }
}

/**
 * Autogenerated input type of TOTPCreate
 */
export type TOTPCreateInput = {
  clientMutationId?: string | null
}

/**
 * Autogenerated return type of TOTPCreate.
 */
export class TOTPCreatePayload extends $Base<"TOTPCreatePayload"> {
  constructor() {
    super("TOTPCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  /**
   * The URI to enter into your one-time password generator. Usually presented to the user as a QR Code
   */
  get provisioningUri(): $Field<"provisioningUri", string> {
    return this.$_select("provisioningUri") as any
  }

  totp<Sel extends Selection<TOTP>>(
    selectorFn: (s: TOTP) => [...Sel],
  ): $Field<"totp", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TOTP()),
    }
    return this.$_select("totp", options as any) as any
  }
}

/**
 * Autogenerated input type of TOTPDelete
 */
export type TOTPDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TOTPDelete.
 */
export class TOTPDeletePayload extends $Base<"TOTPDeletePayload"> {
  constructor() {
    super("TOTPDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  viewer<Sel extends Selection<Viewer>>(
    selectorFn: (s: Viewer) => [...Sel],
  ): $Field<"viewer", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Viewer()),
    }
    return this.$_select("viewer", options as any) as any
  }
}

/**
 * Autogenerated input type of TOTPRecoveryCodesRegenerate
 */
export type TOTPRecoveryCodesRegenerateInput = {
  clientMutationId?: string | null
  totpId: string
}

/**
 * Autogenerated return type of TOTPRecoveryCodesRegenerate.
 */
export class TOTPRecoveryCodesRegeneratePayload extends $Base<"TOTPRecoveryCodesRegeneratePayload"> {
  constructor() {
    super("TOTPRecoveryCodesRegeneratePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  recoveryCodes<Sel extends Selection<RecoveryCodeBatch>>(
    selectorFn: (s: RecoveryCodeBatch) => [...Sel],
  ): $Field<"recoveryCodes", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new RecoveryCodeBatch()),
    }
    return this.$_select("recoveryCodes", options as any) as any
  }

  totp<Sel extends Selection<TOTP>>(
    selectorFn: (s: TOTP) => [...Sel],
  ): $Field<"totp", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TOTP()),
    }
    return this.$_select("totp", options as any) as any
  }
}

/**
 * An organization team
 */
export class Team extends $Base<"Team"> {
  constructor() {
    super("Team")
  }

  /**
   * The time when this team was created
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that created this team
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  /**
   * New organization members will be granted this role on this team
   */
  get defaultMemberRole(): $Field<"defaultMemberRole", TeamMemberRole> {
    return this.$_select("defaultMemberRole") as any
  }

  /**
   * A description of the team
   */
  get description(): $Field<"description", string | null> {
    return this.$_select("description") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * Add new organization members to this team by default
   */
  get isDefaultTeam(): $Field<"isDefaultTeam", boolean> {
    return this.$_select("isDefaultTeam") as any
  }

  /**
   * Users that are part of this team
   */
  members<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      role?: Readonly<Array<TeamMemberRole>> | null
      order?: TeamMemberOrder | null
    }>,
    Sel extends Selection<TeamMemberConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      role?: Readonly<Array<TeamMemberRole>> | null
      order?: TeamMemberOrder | null
    }>,
    selectorFn: (s: TeamMemberConnection) => [...Sel],
  ): $Field<"members", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  members<Sel extends Selection<TeamMemberConnection>>(
    selectorFn: (s: TeamMemberConnection) => [...Sel],
  ): $Field<"members", GetOutput<Sel> | null, GetVariables<Sel>>
  members(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        role: "[TeamMemberRole!]",
        order: "TeamMemberOrder",
      },
      args,

      selection: selectorFn(new TeamMemberConnection()),
    }
    return this.$_select("members", options as any) as any
  }

  /**
   * Whether or not team members can create new pipelines in this team
   */
  get membersCanCreatePipelines(): $Field<"membersCanCreatePipelines", boolean> {
    return this.$_select("membersCanCreatePipelines") as any
  }

  /**
   * Whether or not team members can delete pipelines in this team
   */
  get membersCanDeletePipelines(): $Field<"membersCanDeletePipelines", boolean> {
    return this.$_select("membersCanDeletePipelines") as any
  }

  /**
   * The name of the team
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The organization that this team is a part of
   */
  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  permissions<Sel extends Selection<TeamPermissions>>(
    selectorFn: (s: TeamPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * Pipelines associated with this team
   */
  pipelines<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamPipelineOrder | null
    }>,
    Sel extends Selection<TeamPipelineConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      search?: string | null
      order?: TeamPipelineOrder | null
    }>,
    selectorFn: (s: TeamPipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  pipelines<Sel extends Selection<TeamPipelineConnection>>(
    selectorFn: (s: TeamPipelineConnection) => [...Sel],
  ): $Field<"pipelines", GetOutput<Sel> | null, GetVariables<Sel>>
  pipelines(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        search: "String",
        order: "TeamPipelineOrder",
      },
      args,

      selection: selectorFn(new TeamPipelineConnection()),
    }
    return this.$_select("pipelines", options as any) as any
  }

  /**
   * The privacy setting for this team
   */
  get privacy(): $Field<"privacy", TeamPrivacy> {
    return this.$_select("privacy") as any
  }

  /**
   * Registries associated with this team
   */
  registries<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamRegistryOrder | null
    }>,
    Sel extends Selection<TeamRegistryConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamRegistryOrder | null
    }>,
    selectorFn: (s: TeamRegistryConnection) => [...Sel],
  ): $Field<"registries", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  registries<Sel extends Selection<TeamRegistryConnection>>(
    selectorFn: (s: TeamRegistryConnection) => [...Sel],
  ): $Field<"registries", GetOutput<Sel> | null, GetVariables<Sel>>
  registries(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "TeamRegistryOrder",
      },
      args,

      selection: selectorFn(new TeamRegistryConnection()),
    }
    return this.$_select("registries", options as any) as any
  }

  /**
   * The slug of the team
   */
  get slug(): $Field<"slug", string> {
    return this.$_select("slug") as any
  }

  /**
   * Suites associated with this team
   */
  suites<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamSuiteOrder | null
    }>,
    Sel extends Selection<TeamSuiteConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      order?: TeamSuiteOrder | null
    }>,
    selectorFn: (s: TeamSuiteConnection) => [...Sel],
  ): $Field<"suites", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  suites<Sel extends Selection<TeamSuiteConnection>>(
    selectorFn: (s: TeamSuiteConnection) => [...Sel],
  ): $Field<"suites", GetOutput<Sel> | null, GetVariables<Sel>>
  suites(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        order: "TeamSuiteOrder",
      },
      args,

      selection: selectorFn(new TeamSuiteConnection()),
    }
    return this.$_select("suites", options as any) as any
  }

  /**
   * The public UUID for this team
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class TeamConnection extends $Base<"TeamConnection"> {
  constructor() {
    super("TeamConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<TeamEdge>>(
    selectorFn: (s: TeamEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamCreate
 */
export type TeamCreateInput = {
  clientMutationId?: string | null
  defaultMemberRole: TeamMemberRole
  description?: string | null
  isDefaultTeam: boolean
  membersCanCreatePipelines?: boolean | null
  membersCanDeletePipelines?: boolean | null
  name: string
  organizationID: string
  privacy: TeamPrivacy
}

/**
 * Autogenerated return type of TeamCreate.
 */
export class TeamCreatePayload extends $Base<"TeamCreatePayload"> {
  constructor() {
    super("TeamCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }

  teamEdge<Sel extends Selection<TeamEdge>>(
    selectorFn: (s: TeamEdge) => [...Sel],
  ): $Field<"teamEdge", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamEdge()),
    }
    return this.$_select("teamEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamDelete
 */
export type TeamDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TeamDelete.
 */
export class TeamDeletePayload extends $Base<"TeamDeletePayload"> {
  constructor() {
    super("TeamDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedTeamID(): $Field<"deletedTeamID", string> {
    return this.$_select("deletedTeamID") as any
  }

  organization<Sel extends Selection<Organization>>(
    selectorFn: (s: Organization) => [...Sel],
  ): $Field<"organization", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Organization()),
    }
    return this.$_select("organization", options as any) as any
  }
}

export class TeamEdge extends $Base<"TeamEdge"> {
  constructor() {
    super("TeamEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * An member of a team
 */
export class TeamMember extends $Base<"TeamMember"> {
  constructor() {
    super("TeamMember")
  }

  /**
   * The time when the team member was added
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added this team member
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The organization member associated with this team member
   */
  organizationMember<Sel extends Selection<OrganizationMember>>(
    selectorFn: (s: OrganizationMember) => [...Sel],
  ): $Field<"organizationMember", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new OrganizationMember()),
    }
    return this.$_select("organizationMember", options as any) as any
  }

  permissions<Sel extends Selection<TeamMemberPermissions>>(
    selectorFn: (s: TeamMemberPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamMemberPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The users role within the team
   */
  get role(): $Field<"role", TeamMemberRole> {
    return this.$_select("role") as any
  }

  /**
   * The team associated with this team member
   */
  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  /**
   * The user associated with this team member
   */
  user<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"user", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("user", options as any) as any
  }

  /**
   * The public UUID for this team member
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

export class TeamMemberConnection extends $Base<"TeamMemberConnection"> {
  constructor() {
    super("TeamMemberConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<TeamMemberEdge>>(
    selectorFn: (s: TeamMemberEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamMemberEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamMemberCreate
 */
export type TeamMemberCreateInput = {
  clientMutationId?: string | null
  role?: TeamMemberRole | null
  teamID: string
  userID: string
}

/**
 * Autogenerated return type of TeamMemberCreate.
 */
export class TeamMemberCreatePayload extends $Base<"TeamMemberCreatePayload"> {
  constructor() {
    super("TeamMemberCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  teamMemberEdge<Sel extends Selection<TeamMemberEdge>>(
    selectorFn: (s: TeamMemberEdge) => [...Sel],
  ): $Field<"teamMemberEdge", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamMemberEdge()),
    }
    return this.$_select("teamMemberEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamMemberDelete
 */
export type TeamMemberDeleteInput = {
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TeamMemberDelete.
 */
export class TeamMemberDeletePayload extends $Base<"TeamMemberDeletePayload"> {
  constructor() {
    super("TeamMemberDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedTeamMemberID(): $Field<"deletedTeamMemberID", string> {
    return this.$_select("deletedTeamMemberID") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

export class TeamMemberEdge extends $Base<"TeamMemberEdge"> {
  constructor() {
    super("TeamMemberEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<TeamMember>>(
    selectorFn: (s: TeamMember) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamMember()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort team members by
 */
export enum TeamMemberOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by most relevant results when doing a search
   */
  RELEVANCE = "RELEVANCE",

  /**
   * Order by the most recently added members first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Permissions information about what actions the current user can do against the team membership record
 */
export class TeamMemberPermissions extends $Base<"TeamMemberPermissions"> {
  constructor() {
    super("TeamMemberPermissions")
  }

  /**
   * Whether the user can delete the user from the team
   */
  teamMemberDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamMemberDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamMemberDelete", options as any) as any
  }

  /**
   * Whether the user can update the team's members admin status
   */
  teamMemberUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamMemberUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamMemberUpdate", options as any) as any
  }
}

/**
 * The roles a user can be within a team
 */
export enum TeamMemberRole {
  /**
   * The user is a regular member of the team
   */
  MEMBER = "MEMBER",

  /**
   * The user can manage pipelines and users within the team
   */
  MAINTAINER = "MAINTAINER",
}

/**
 * Autogenerated input type of TeamMemberUpdate
 */
export type TeamMemberUpdateInput = {
  clientMutationId?: string | null
  id: string
  role: TeamMemberRole
}

/**
 * Autogenerated return type of TeamMemberUpdate.
 */
export class TeamMemberUpdatePayload extends $Base<"TeamMemberUpdatePayload"> {
  constructor() {
    super("TeamMemberUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  teamMember<Sel extends Selection<TeamMember>>(
    selectorFn: (s: TeamMember) => [...Sel],
  ): $Field<"teamMember", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamMember()),
    }
    return this.$_select("teamMember", options as any) as any
  }
}

/**
 * The different orders you can sort teams by
 */
export enum TeamOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by the most recently created teams first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",

  /**
   * Order by relevance when searching for teams
   */
  RELEVANCE = "RELEVANCE",
}

/**
 * Permissions information about what actions the current user can do against the team
 */
export class TeamPermissions extends $Base<"TeamPermissions"> {
  constructor() {
    super("TeamPermissions")
  }

  /**
   * Whether the user can see the pipelines within the team
   */
  pipelineView<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"pipelineView", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("pipelineView", options as any) as any
  }

  /**
   * Whether the user can delete the team
   */
  teamDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamDelete", options as any) as any
  }

  /**
   * Whether the user can administer add members from the organization to this team
   */
  teamMemberCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamMemberCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamMemberCreate", options as any) as any
  }

  /**
   * Whether the user can add pipelines from other teams to this one
   */
  teamPipelineCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamPipelineCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamPipelineCreate", options as any) as any
  }

  /**
   * Whether the user can add registries from other teams to this one
   */
  teamRegistryCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamRegistryCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamRegistryCreate", options as any) as any
  }

  /**
   * Whether the user can add suites from other teams to this one
   */
  teamSuiteCreate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamSuiteCreate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamSuiteCreate", options as any) as any
  }

  /**
   * Whether the user can update the team's name and description
   */
  teamUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamUpdate", options as any) as any
  }
}

/**
 * An pipeline that's been assigned to a team
 */
export class TeamPipeline extends $Base<"TeamPipeline"> {
  constructor() {
    super("TeamPipeline")
  }

  /**
   * The access level users have to this pipeline
   */
  get accessLevel(): $Field<"accessLevel", PipelineAccessLevels> {
    return this.$_select("accessLevel") as any
  }

  /**
   * The time when the pipeline was added
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added this pipeline to the team
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  permissions<Sel extends Selection<TeamPipelinePermissions>>(
    selectorFn: (s: TeamPipelinePermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipelinePermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The pipeline associated with this team member
   */
  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  /**
   * The team associated with this team member
   */
  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  /**
   * The public UUID for this team member
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A collection of TeamPipeline records
 */
export class TeamPipelineConnection extends $Base<"TeamPipelineConnection"> {
  constructor() {
    super("TeamPipelineConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<TeamPipelineEdge>>(
    selectorFn: (s: TeamPipelineEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipelineEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamPipelineCreate
 */
export type TeamPipelineCreateInput = {
  accessLevel?: PipelineAccessLevels | null
  clientMutationId?: string | null
  pipelineID: string
  teamID: string
}

/**
 * Autogenerated return type of TeamPipelineCreate.
 */
export class TeamPipelineCreatePayload extends $Base<"TeamPipelineCreatePayload"> {
  constructor() {
    super("TeamPipelineCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  pipeline<Sel extends Selection<Pipeline>>(
    selectorFn: (s: Pipeline) => [...Sel],
  ): $Field<"pipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Pipeline()),
    }
    return this.$_select("pipeline", options as any) as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  teamPipeline<Sel extends Selection<TeamPipeline>>(
    selectorFn: (s: TeamPipeline) => [...Sel],
  ): $Field<"teamPipeline", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipeline()),
    }
    return this.$_select("teamPipeline", options as any) as any
  }

  teamPipelineEdge<Sel extends Selection<TeamPipelineEdge>>(
    selectorFn: (s: TeamPipelineEdge) => [...Sel],
  ): $Field<"teamPipelineEdge", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipelineEdge()),
    }
    return this.$_select("teamPipelineEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamPipelineDelete
 */
export type TeamPipelineDeleteInput = {
  clientMutationId?: string | null
  force?: boolean | null
  id: string
}

/**
 * Autogenerated return type of TeamPipelineDelete.
 */
export class TeamPipelineDeletePayload extends $Base<"TeamPipelineDeletePayload"> {
  constructor() {
    super("TeamPipelineDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedTeamPipelineID(): $Field<"deletedTeamPipelineID", string> {
    return this.$_select("deletedTeamPipelineID") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

export class TeamPipelineEdge extends $Base<"TeamPipelineEdge"> {
  constructor() {
    super("TeamPipelineEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<TeamPipeline>>(
    selectorFn: (s: TeamPipeline) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipeline()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort pipelines by
 */
export enum TeamPipelineOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by most relevant results when doing a search
   */
  RELEVANCE = "RELEVANCE",

  /**
   * Order by the most recently added pipelines first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Permission information about what actions the current user can do against the team pipelines
 */
export class TeamPipelinePermissions extends $Base<"TeamPipelinePermissions"> {
  constructor() {
    super("TeamPipelinePermissions")
  }

  /**
   * Whether the user can delete the pipeline from the team
   */
  teamPipelineDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamPipelineDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamPipelineDelete", options as any) as any
  }

  /**
   * Whether the user can update the pipeline connection to the team
   */
  teamPipelineUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamPipelineUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamPipelineUpdate", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamPipelineUpdate
 */
export type TeamPipelineUpdateInput = {
  accessLevel: PipelineAccessLevels
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TeamPipelineUpdate.
 */
export class TeamPipelineUpdatePayload extends $Base<"TeamPipelineUpdatePayload"> {
  constructor() {
    super("TeamPipelineUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  teamPipeline<Sel extends Selection<TeamPipeline>>(
    selectorFn: (s: TeamPipeline) => [...Sel],
  ): $Field<"teamPipeline", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamPipeline()),
    }
    return this.$_select("teamPipeline", options as any) as any
  }
}

/**
 * Whether a team is visible or secret within an organization
 */
export enum TeamPrivacy {
  /**
   * Visible to all members of the organization
   */
  VISIBLE = "VISIBLE",

  /**
   * Visible to organization administrators and members
   */
  SECRET = "SECRET",
}

/**
 * A registry that's been assigned to a team
 */
export class TeamRegistry extends $Base<"TeamRegistry"> {
  constructor() {
    super("TeamRegistry")
  }

  /**
   * The access level users have to this registry
   */
  get accessLevel(): $Field<"accessLevel", RegistryAccessLevels> {
    return this.$_select("accessLevel") as any
  }

  /**
   * The time when the registry was added
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added this registry to the team
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  permissions<Sel extends Selection<TeamRegistryPermissions>>(
    selectorFn: (s: TeamRegistryPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistryPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The registry associated with this team member
   */
  registry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("registry", options as any) as any
  }

  /**
   * The team associated with this team member
   */
  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  /**
   * The time when the assignment was last updated
   */
  get updatedAt(): $Field<"updatedAt", CustomScalar<DateTime>> {
    return this.$_select("updatedAt") as any
  }

  /**
   * The user that last updated this assignment
   */
  updatedBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"updatedBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("updatedBy", options as any) as any
  }

  /**
   * The public UUID for this team registry
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A collection of TeamRegistry records
 */
export class TeamRegistryConnection extends $Base<"TeamRegistryConnection"> {
  constructor() {
    super("TeamRegistryConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<TeamRegistryEdge>>(
    selectorFn: (s: TeamRegistryEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistryEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamRegistryCreate
 */
export type TeamRegistryCreateInput = {
  accessLevel?: RegistryAccessLevels | null
  clientMutationId?: string | null
  registryID: string
  teamID: string
}

/**
 * Autogenerated return type of TeamRegistryCreate.
 */
export class TeamRegistryCreatePayload extends $Base<"TeamRegistryCreatePayload"> {
  constructor() {
    super("TeamRegistryCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  registry<Sel extends Selection<Registry>>(
    selectorFn: (s: Registry) => [...Sel],
  ): $Field<"registry", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Registry()),
    }
    return this.$_select("registry", options as any) as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  teamRegistry<Sel extends Selection<TeamRegistry>>(
    selectorFn: (s: TeamRegistry) => [...Sel],
  ): $Field<"teamRegistry", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistry()),
    }
    return this.$_select("teamRegistry", options as any) as any
  }

  teamRegistryEdge<Sel extends Selection<TeamRegistryEdge>>(
    selectorFn: (s: TeamRegistryEdge) => [...Sel],
  ): $Field<"teamRegistryEdge", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistryEdge()),
    }
    return this.$_select("teamRegistryEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamRegistryDelete
 */
export type TeamRegistryDeleteInput = {
  clientMutationId?: string | null
  force?: boolean | null
  id: string
}

/**
 * Autogenerated return type of TeamRegistryDelete.
 */
export class TeamRegistryDeletePayload extends $Base<"TeamRegistryDeletePayload"> {
  constructor() {
    super("TeamRegistryDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedTeamRegistryID(): $Field<"deletedTeamRegistryID", string> {
    return this.$_select("deletedTeamRegistryID") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

export class TeamRegistryEdge extends $Base<"TeamRegistryEdge"> {
  constructor() {
    super("TeamRegistryEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<TeamRegistry>>(
    selectorFn: (s: TeamRegistry) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistry()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort team registries by
 */
export enum TeamRegistryOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by most relevant results when doing a search
   */
  RELEVANCE = "RELEVANCE",

  /**
   * Order by the most recently added registries first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Permission information about what actions the current user can do against the team registries
 */
export class TeamRegistryPermissions extends $Base<"TeamRegistryPermissions"> {
  constructor() {
    super("TeamRegistryPermissions")
  }

  /**
   * Whether the user can delete the registry from the team
   */
  teamRegistryDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamRegistryDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamRegistryDelete", options as any) as any
  }

  /**
   * Whether the user can update the registry connection to the team
   */
  teamRegistryUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamRegistryUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamRegistryUpdate", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamRegistryUpdate
 */
export type TeamRegistryUpdateInput = {
  accessLevel: RegistryAccessLevels
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TeamRegistryUpdate.
 */
export class TeamRegistryUpdatePayload extends $Base<"TeamRegistryUpdatePayload"> {
  constructor() {
    super("TeamRegistryUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  teamRegistry<Sel extends Selection<TeamRegistry>>(
    selectorFn: (s: TeamRegistry) => [...Sel],
  ): $Field<"teamRegistry", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamRegistry()),
    }
    return this.$_select("teamRegistry", options as any) as any
  }
}

/**
 * A Team identifier using a slug, and optionally negated with a leading `!`
 */
export type TeamSelector = unknown

/**
 * A suite that's been assigned to a team
 */
export class TeamSuite extends $Base<"TeamSuite"> {
  constructor() {
    super("TeamSuite")
  }

  /**
   * The access level users have to this suite
   */
  get accessLevel(): $Field<"accessLevel", SuiteAccessLevels> {
    return this.$_select("accessLevel") as any
  }

  /**
   * The time when the suite was added
   */
  get createdAt(): $Field<"createdAt", CustomScalar<DateTime>> {
    return this.$_select("createdAt") as any
  }

  /**
   * The user that added this suite to the team
   */
  createdBy<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"createdBy", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("createdBy", options as any) as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  permissions<Sel extends Selection<TeamSuitePermissions>>(
    selectorFn: (s: TeamSuitePermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuitePermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
   * The suite associated with this team member
   */
  suite<Sel extends Selection<Suite>>(
    selectorFn: (s: Suite) => [...Sel],
  ): $Field<"suite", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Suite()),
    }
    return this.$_select("suite", options as any) as any
  }

  /**
   * The team associated with this team member
   */
  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  /**
   * The public UUID for this team suite
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A collection of TeamSuite records
 */
export class TeamSuiteConnection extends $Base<"TeamSuiteConnection"> {
  constructor() {
    super("TeamSuiteConnection")
  }

  get count(): $Field<"count", number> {
    return this.$_select("count") as any
  }

  edges<Sel extends Selection<TeamSuiteEdge>>(
    selectorFn: (s: TeamSuiteEdge) => [...Sel],
  ): $Field<"edges", Array<GetOutput<Sel> | null> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuiteEdge()),
    }
    return this.$_select("edges", options as any) as any
  }

  pageInfo<Sel extends Selection<PageInfo>>(
    selectorFn: (s: PageInfo) => [...Sel],
  ): $Field<"pageInfo", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new PageInfo()),
    }
    return this.$_select("pageInfo", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamSuiteCreate
 */
export type TeamSuiteCreateInput = {
  accessLevel?: SuiteAccessLevels | null
  clientMutationId?: string | null
  suiteID: string
  teamID: string
}

/**
 * Autogenerated return type of TeamSuiteCreate.
 */
export class TeamSuiteCreatePayload extends $Base<"TeamSuiteCreatePayload"> {
  constructor() {
    super("TeamSuiteCreatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  suite<Sel extends Selection<Suite>>(
    selectorFn: (s: Suite) => [...Sel],
  ): $Field<"suite", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Suite()),
    }
    return this.$_select("suite", options as any) as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }

  teamSuite<Sel extends Selection<TeamSuite>>(
    selectorFn: (s: TeamSuite) => [...Sel],
  ): $Field<"teamSuite", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuite()),
    }
    return this.$_select("teamSuite", options as any) as any
  }

  teamSuiteEdge<Sel extends Selection<TeamSuiteEdge>>(
    selectorFn: (s: TeamSuiteEdge) => [...Sel],
  ): $Field<"teamSuiteEdge", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuiteEdge()),
    }
    return this.$_select("teamSuiteEdge", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamSuiteDelete
 */
export type TeamSuiteDeleteInput = {
  clientMutationId?: string | null
  force?: boolean | null
  id: string
}

/**
 * Autogenerated return type of TeamSuiteDelete.
 */
export class TeamSuiteDeletePayload extends $Base<"TeamSuiteDeletePayload"> {
  constructor() {
    super("TeamSuiteDeletePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  get deletedTeamSuiteID(): $Field<"deletedTeamSuiteID", string> {
    return this.$_select("deletedTeamSuiteID") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

export class TeamSuiteEdge extends $Base<"TeamSuiteEdge"> {
  constructor() {
    super("TeamSuiteEdge")
  }

  get cursor(): $Field<"cursor", string> {
    return this.$_select("cursor") as any
  }

  node<Sel extends Selection<TeamSuite>>(
    selectorFn: (s: TeamSuite) => [...Sel],
  ): $Field<"node", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuite()),
    }
    return this.$_select("node", options as any) as any
  }
}

/**
 * The different orders you can sort suites by
 */
export enum TeamSuiteOrder {
  /**
   * Order by name alphabetically
   */
  NAME = "NAME",

  /**
   * Order by most relevant results when doing a search
   */
  RELEVANCE = "RELEVANCE",

  /**
   * Order by the most recently added suites first
   */
  RECENTLY_CREATED = "RECENTLY_CREATED",
}

/**
 * Permission information about what actions the current user can do against the team suites
 */
export class TeamSuitePermissions extends $Base<"TeamSuitePermissions"> {
  constructor() {
    super("TeamSuitePermissions")
  }

  /**
   * Whether the user can delete the suite from the team
   */
  teamSuiteDelete<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamSuiteDelete", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamSuiteDelete", options as any) as any
  }

  /**
   * Whether the user can update the suite connection to the team
   */
  teamSuiteUpdate<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"teamSuiteUpdate", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("teamSuiteUpdate", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamSuiteUpdate
 */
export type TeamSuiteUpdateInput = {
  accessLevel: SuiteAccessLevels
  clientMutationId?: string | null
  id: string
}

/**
 * Autogenerated return type of TeamSuiteUpdate.
 */
export class TeamSuiteUpdatePayload extends $Base<"TeamSuiteUpdatePayload"> {
  constructor() {
    super("TeamSuiteUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  teamSuite<Sel extends Selection<TeamSuite>>(
    selectorFn: (s: TeamSuite) => [...Sel],
  ): $Field<"teamSuite", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new TeamSuite()),
    }
    return this.$_select("teamSuite", options as any) as any
  }
}

/**
 * Autogenerated input type of TeamUpdate
 */
export type TeamUpdateInput = {
  clientMutationId?: string | null
  defaultMemberRole: TeamMemberRole
  description?: string | null
  id: string
  isDefaultTeam: boolean
  membersCanCreatePipelines?: boolean | null
  membersCanDeletePipelines?: boolean | null
  name: string
  privacy?: TeamPrivacy | null
}

/**
 * Autogenerated return type of TeamUpdate.
 */
export class TeamUpdatePayload extends $Base<"TeamUpdatePayload"> {
  constructor() {
    super("TeamUpdatePayload")
  }

  /**
   * A unique identifier for the client performing the mutation.
   */
  get clientMutationId(): $Field<"clientMutationId", string | null> {
    return this.$_select("clientMutationId") as any
  }

  team<Sel extends Selection<Team>>(
    selectorFn: (s: Team) => [...Sel],
  ): $Field<"team", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Team()),
    }
    return this.$_select("team", options as any) as any
  }
}

/**
 * A person who hasn’t signed up to Buildkite
 */
export class UnregisteredUser extends $Base<"UnregisteredUser"> {
  constructor() {
    super("UnregisteredUser")
  }

  avatar<Sel extends Selection<Avatar>>(
    selectorFn: (s: Avatar) => [...Sel],
  ): $Field<"avatar", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Avatar()),
    }
    return this.$_select("avatar", options as any) as any
  }

  /**
   * The email for the user
   */
  get email(): $Field<"email", string | null> {
    return this.$_select("email") as any
  }

  /**
   * The name of the user
   */
  get name(): $Field<"name", string | null> {
    return this.$_select("name") as any
  }
}

/**
 * A user
 */
export class User extends $Base<"User"> {
  constructor() {
    super("User")
  }

  avatar<Sel extends Selection<Avatar>>(
    selectorFn: (s: Avatar) => [...Sel],
  ): $Field<"avatar", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Avatar()),
    }
    return this.$_select("avatar", options as any) as any
  }

  /**
   * If this user account is an official bot managed by Buildkite
   */
  get bot(): $Field<"bot", boolean> {
    return this.$_select("bot") as any
  }

  /**
   * Returns builds that this user has created.
   */
  builds<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: Readonly<Array<string>> | null
      metaData?: Readonly<Array<string>> | null
    }>,
    Sel extends Selection<BuildConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: Readonly<Array<string>> | null
      metaData?: Readonly<Array<string>> | null
    }>,
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  builds<Sel extends Selection<BuildConnection>>(
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel>>
  builds(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
        state: "[BuildStates!]",
        branch: "[String!]",
        metaData: "[String!]",
      },
      args,

      selection: selectorFn(new BuildConnection()),
    }
    return this.$_select("builds", options as any) as any
  }

  /**
   * The primary email for the user
   */
  get email(): $Field<"email", string> {
    return this.$_select("email") as any
  }

  /**
   * Does the user have a password set
   */
  get hasPassword(): $Field<"hasPassword", boolean> {
    return this.$_select("hasPassword") as any
  }

  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  /**
   * The name of the user
   */
  get name(): $Field<"name", string> {
    return this.$_select("name") as any
  }

  /**
   * The public UUID of the user
   */
  get uuid(): $Field<"uuid", string> {
    return this.$_select("uuid") as any
  }
}

/**
 * A User identifier using a UUID, and optionally negated with a leading `!`
 */
export type UserSelector = unknown

/**
 * Represents the current user session
 */
export class Viewer extends $Base<"Viewer"> {
  constructor() {
    super("Viewer")
  }

  authorizations<
    Args extends VariabledInput<{
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<AuthorizationType>> | null
    }>,
    Sel extends Selection<AuthorizationConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      after?: string | null
      last?: number | null
      before?: string | null
      type?: Readonly<Array<AuthorizationType>> | null
    }>,
    selectorFn: (s: AuthorizationConnection) => [...Sel],
  ): $Field<"authorizations", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  authorizations<Sel extends Selection<AuthorizationConnection>>(
    selectorFn: (s: AuthorizationConnection) => [...Sel],
  ): $Field<"authorizations", GetOutput<Sel> | null, GetVariables<Sel>>
  authorizations(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        after: "String",
        last: "Int",
        before: "String",
        type: "[AuthorizationType!]",
      },
      args,

      selection: selectorFn(new AuthorizationConnection()),
    }
    return this.$_select("authorizations", options as any) as any
  }

  builds<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: string | null
      metaData?: Readonly<Array<string>> | null
    }>,
    Sel extends Selection<BuildConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
      state?: Readonly<Array<BuildStates>> | null
      branch?: string | null
      metaData?: Readonly<Array<string>> | null
    }>,
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  builds<Sel extends Selection<BuildConnection>>(
    selectorFn: (s: BuildConnection) => [...Sel],
  ): $Field<"builds", GetOutput<Sel> | null, GetVariables<Sel>>
  builds(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
        state: "[BuildStates!]",
        branch: "String",
        metaData: "[String!]",
      },
      args,

      selection: selectorFn(new BuildConnection()),
    }
    return this.$_select("builds", options as any) as any
  }

  /**
   * Emails associated with the current user
   */
  emails<
    Args extends VariabledInput<{
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
      verified?: boolean | null
    }>,
    Sel extends Selection<EmailConnection>,
  >(
    args: ExactArgNames<Args, {
      after?: string | null
      before?: string | null
      first?: number | null
      last?: number | null
      verified?: boolean | null
    }>,
    selectorFn: (s: EmailConnection) => [...Sel],
  ): $Field<"emails", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  emails<Sel extends Selection<EmailConnection>>(
    selectorFn: (s: EmailConnection) => [...Sel],
  ): $Field<"emails", GetOutput<Sel> | null, GetVariables<Sel>>
  emails(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        after: "String",
        before: "String",
        first: "Int",
        last: "Int",
        verified: "Boolean",
      },
      args,

      selection: selectorFn(new EmailConnection()),
    }
    return this.$_select("emails", options as any) as any
  }

  /**
   * The ID of the current user
   */
  get id(): $Field<"id", string> {
    return this.$_select("id") as any
  }

  notice<
    Args extends VariabledInput<{
      namespace: NoticeNamespaces
      scope: string
    }>,
    Sel extends Selection<Notice>,
  >(
    args: ExactArgNames<Args, {
      namespace: NoticeNamespaces
      scope: string
    }>,
    selectorFn: (s: Notice) => [...Sel],
  ): $Field<"notice", GetOutput<Sel> | null, GetVariables<Sel, Args>> {
    const options = {
      argTypes: {
        namespace: "NoticeNamespaces!",
        scope: "String!",
      },
      args,

      selection: selectorFn(new Notice()),
    }
    return this.$_select("notice", options as any) as any
  }

  organizations<
    Args extends VariabledInput<{
      first?: number | null
      last?: number | null
    }>,
    Sel extends Selection<OrganizationConnection>,
  >(
    args: ExactArgNames<Args, {
      first?: number | null
      last?: number | null
    }>,
    selectorFn: (s: OrganizationConnection) => [...Sel],
  ): $Field<"organizations", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  organizations<Sel extends Selection<OrganizationConnection>>(
    selectorFn: (s: OrganizationConnection) => [...Sel],
  ): $Field<"organizations", GetOutput<Sel> | null, GetVariables<Sel>>
  organizations(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        first: "Int",
        last: "Int",
      },
      args,

      selection: selectorFn(new OrganizationConnection()),
    }
    return this.$_select("organizations", options as any) as any
  }

  /**
   * The current user's permissions
   */
  permissions<Sel extends Selection<ViewerPermissions>>(
    selectorFn: (s: ViewerPermissions) => [...Sel],
  ): $Field<"permissions", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new ViewerPermissions()),
    }
    return this.$_select("permissions", options as any) as any
  }

  /**
 * The user's active TOTP configuration, if any.

This field is private, requires an escalated session, and cannot be accessed via the public GraphQL API.
 */
  totp<
    Args extends VariabledInput<{
      id?: string | null
    }>,
    Sel extends Selection<TOTP>,
  >(
    args: ExactArgNames<Args, {
      id?: string | null
    }>,
    selectorFn: (s: TOTP) => [...Sel],
  ): $Field<"totp", GetOutput<Sel> | null, GetVariables<Sel, Args>>
  totp<Sel extends Selection<TOTP>>(
    selectorFn: (s: TOTP) => [...Sel],
  ): $Field<"totp", GetOutput<Sel> | null, GetVariables<Sel>>
  totp(arg1: any, arg2?: any) {
    const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 }

    const options = {
      argTypes: {
        id: "ID",
      },
      args,

      selection: selectorFn(new TOTP()),
    }
    return this.$_select("totp", options as any) as any
  }

  /**
   * The current user
   */
  user<Sel extends Selection<User>>(
    selectorFn: (s: User) => [...Sel],
  ): $Field<"user", GetOutput<Sel> | null, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new User()),
    }
    return this.$_select("user", options as any) as any
  }
}

/**
 * Permissions information about what actions the current user can do
 */
export class ViewerPermissions extends $Base<"ViewerPermissions"> {
  constructor() {
    super("ViewerPermissions")
  }

  /**
   * Whether the viewer can configure two-factor authentication
   */
  totpConfigure<Sel extends Selection<Permission>>(
    selectorFn: (s: Permission) => [...Sel],
  ): $Field<"totpConfigure", GetOutput<Sel>, GetVariables<Sel>> {
    const options = {
      selection: selectorFn(new Permission()),
    }
    return this.$_select("totpConfigure", options as any) as any
  }
}

/**
 * A blob of XML represented as a pretty formatted string
 */
export type XML = unknown

/**
 * A blob of YAML
 */
export type YAML = unknown

const $Root = {
  query: Query,
  mutation: Mutation,
}

namespace $RootTypes {
  export type query = Query
  export type mutation = Mutation
}

export function query<Sel extends Selection<$RootTypes.query>>(
  name: string,
  selectFn: (q: $RootTypes.query) => [...Sel],
): TypedDocumentNode<GetOutput<Sel>, GetVariables<Sel>>
export function query<Sel extends Selection<$RootTypes.query>>(
  selectFn: (q: $RootTypes.query) => [...Sel],
): TypedDocumentNode<GetOutput<Sel>, Simplify<GetVariables<Sel>>>
export function query<Sel extends Selection<$RootTypes.query>>(name: any, selectFn?: any) {
  if (!selectFn) {
    selectFn = name
    name = ""
  }
  let field = new $Field<"query", GetOutput<Sel>, GetVariables<Sel>>("query", {
    selection: selectFn(new $Root.query()),
  })
  const str = fieldToQuery(`query ${name}`, field)

  return gql(str) as any
}

export function mutation<Sel extends Selection<$RootTypes.mutation>>(
  name: string,
  selectFn: (q: $RootTypes.mutation) => [...Sel],
): TypedDocumentNode<GetOutput<Sel>, GetVariables<Sel>>
export function mutation<Sel extends Selection<$RootTypes.mutation>>(
  selectFn: (q: $RootTypes.mutation) => [...Sel],
): TypedDocumentNode<GetOutput<Sel>, Simplify<GetVariables<Sel>>>
export function mutation<Sel extends Selection<$RootTypes.query>>(name: any, selectFn?: any) {
  if (!selectFn) {
    selectFn = name
    name = ""
  }
  let field = new $Field<"mutation", GetOutput<Sel>, GetVariables<Sel>>("mutation", {
    selection: selectFn(new $Root.mutation()),
  })
  const str = fieldToQuery(`mutation ${name}`, field)

  return gql(str) as any
}

const $InputTypes: { [key: string]: { [key: string]: string } } = {
  APIAccessTokenCodeAuthorizeMutationInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  AgentPauseInput: {
    clientMutationId: "String",
    id: "ID!",
    note: "String",
    timeoutInMinutes: "Int",
  },
  AgentResumeInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  AgentStopInput: {
    clientMutationId: "String",
    graceful: "Boolean",
    id: "ID!",
  },
  AgentTokenCreateInput: {
    clientMutationId: "String",
    description: "String",
    organizationID: "ID!",
    public: "Boolean",
  },
  AgentTokenRevokeInput: {
    clientMutationId: "String",
    id: "ID!",
    reason: "String!",
  },
  BuildAnnotateInput: {
    append: "Boolean",
    body: "String",
    buildID: "ID!",
    clientMutationId: "String",
    context: "String",
    priority: "Int",
    style: "AnnotationStyle",
  },
  BuildAuthorInput: {
    email: "String!",
    name: "String!",
  },
  BuildCancelInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  BuildCreateInput: {
    author: "BuildAuthorInput",
    branch: "String",
    clientMutationId: "String",
    commit: "String",
    env: "[String!]",
    message: "String",
    metaData: "[BuildMetaDataInput!]",
    pipelineID: "ID!",
  },
  BuildMetaDataInput: {
    key: "String!",
    value: "String!",
  },
  BuildRebuildInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  ClusterAgentTokenCreateInput: {
    allowedIpAddresses: "String",
    clientMutationId: "String",
    clusterId: "ID!",
    description: "String!",
    expiresAt: "DateTime",
    organizationId: "ID!",
  },
  ClusterAgentTokenRevokeInput: {
    clientMutationId: "String",
    id: "ID!",
    organizationId: "ID!",
  },
  ClusterAgentTokenUpdateInput: {
    allowedIpAddresses: "String",
    clientMutationId: "String",
    description: "String!",
    id: "ID!",
    organizationId: "ID!",
  },
  ClusterCreateInput: {
    clientMutationId: "String",
    color: "String",
    description: "String",
    emoji: "String",
    name: "String!",
    organizationId: "ID!",
  },
  ClusterDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
    organizationId: "ID!",
  },
  ClusterQueueCreateInput: {
    clientMutationId: "String",
    clusterId: "ID!",
    description: "String",
    hostedAgents: "HostedAgentsQueueSettingsCreateInput",
    key: "String!",
    organizationId: "ID!",
  },
  ClusterQueueDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
    organizationId: "ID!",
  },
  ClusterQueuePauseDispatchInput: {
    clientMutationId: "String",
    id: "ID!",
    note: "String",
  },
  ClusterQueueResumeDispatchInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  ClusterQueueUpdateInput: {
    clientMutationId: "String",
    description: "String",
    hostedAgents: "HostedAgentsQueueSettingsUpdateInput",
    id: "ID!",
    organizationId: "ID!",
  },
  ClusterUpdateInput: {
    clientMutationId: "String",
    color: "String",
    defaultQueueId: "ID",
    description: "String",
    emoji: "String",
    id: "ID!",
    name: "String",
    organizationId: "ID!",
  },
  EmailCreateInput: {
    address: "String!",
    clientMutationId: "String",
  },
  EmailResendVerificationInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  GraphQLSnippetCreateInput: {
    clientMutationId: "String",
    operationName: "ID",
    query: "String!",
  },
  HostedAgentsLinuxPlatformSettingsInput: {
    agentImageRef: "String",
  },
  HostedAgentsMacosPlatformSettingsInput: {
    macosVersion: "HostedAgentMacOSVersion",
    xcodeVersion: "String",
  },
  HostedAgentsPlatformSettingsInput: {
    linux: "HostedAgentsLinuxPlatformSettingsInput",
    macos: "HostedAgentsMacosPlatformSettingsInput",
  },
  HostedAgentsQueueSettingsCreateInput: {
    instanceShape: "HostedAgentInstanceShapeName!",
    platformSettings: "HostedAgentsPlatformSettingsInput",
  },
  HostedAgentsQueueSettingsUpdateInput: {
    agentImageRef: "String",
    instanceShape: "HostedAgentInstanceShapeName",
    platformSettings: "HostedAgentsPlatformSettingsInput",
  },
  JobConcurrencySearch: {
    group: "[String!]",
  },
  JobPrioritySearch: {
    number: "[Int!]",
  },
  JobStepSearch: {
    key: "[String!]",
  },
  JobTypeBlockUnblockInput: {
    clientMutationId: "String",
    fields: "JSON",
    id: "ID!",
  },
  JobTypeCommandCancelInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  JobTypeCommandRetryInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  NoticeDismissInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  OrganizationAPIAccessTokenRevokeMutationInput: {
    apiAccessTokenId: "ID!",
    clientMutationId: "String",
    organizationId: "ID!",
  },
  OrganizationAPIIPAllowlistUpdateMutationInput: {
    clientMutationId: "String",
    ipAddresses: "String!",
    organizationID: "ID!",
  },
  OrganizationBannerDeleteInput: {
    clientMutationId: "String",
    organizationId: "ID!",
  },
  OrganizationBannerUpsertInput: {
    clientMutationId: "String",
    message: "String!",
    organizationId: "ID!",
  },
  OrganizationEnforceTwoFactorAuthenticationForMembersUpdateMutationInput: {
    clientMutationId: "String",
    membersRequireTwoFactorAuthentication: "Boolean!",
    organizationId: "ID!",
  },
  OrganizationInvitationCreateInput: {
    clientMutationId: "String",
    emails: "[String!]!",
    organizationID: "ID!",
    role: "OrganizationMemberRole",
    sso: "OrganizationInvitationSSOInput",
    teams: "[OrganizationInvitationTeamAssignmentInput!]",
  },
  OrganizationInvitationResendInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  OrganizationInvitationRevokeInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  OrganizationInvitationSSOInput: {
    mode: "OrganizationMemberSSOModeEnum!",
  },
  OrganizationInvitationTeamAssignmentInput: {
    id: "ID!",
    role: "TeamMemberRole!",
  },
  OrganizationMemberDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  OrganizationMemberSSOInput: {
    mode: "OrganizationMemberSSOModeEnum!",
  },
  OrganizationMemberSecurityInput: {
    passwordProtected: "Boolean",
    twoFactorEnabled: "Boolean",
  },
  OrganizationMemberUpdateInput: {
    clientMutationId: "String",
    id: "ID!",
    role: "OrganizationMemberRole",
    sso: "OrganizationMemberSSOInput",
  },
  OrganizationRevokeInactiveTokensAfterUpdateMutationInput: {
    clientMutationId: "String",
    organizationId: "ID!",
    revokeInactiveTokensAfter: "RevokeInactiveTokenPeriod!",
  },
  PipelineArchiveInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineCreateInput: {
    allowRebuilds: "Boolean",
    branchConfiguration: "String",
    cancelIntermediateBuilds: "Boolean",
    cancelIntermediateBuildsBranchFilter: "String",
    clientMutationId: "String",
    clusterId: "ID",
    color: "String",
    defaultBranch: "String",
    defaultTimeoutInMinutes: "Int",
    description: "String",
    emoji: "String",
    maximumTimeoutInMinutes: "Int",
    name: "String!",
    nextBuildNumber: "Int",
    organizationId: "ID!",
    pipelineTemplateId: "ID",
    repository: "PipelineRepositoryInput!",
    skipIntermediateBuilds: "Boolean",
    skipIntermediateBuildsBranchFilter: "String",
    steps: "PipelineStepsInput",
    tags: "[PipelineTagInput!]",
    teams: "[PipelineTeamAssignmentInput!]",
    visibility: "PipelineVisibility",
  },
  PipelineCreateWebhookInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineFavoriteInput: {
    clientMutationId: "String",
    favorite: "Boolean!",
    id: "ID!",
  },
  PipelineRepositoryInput: {
    url: "String!",
  },
  PipelineRotateWebhookURLInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineScheduleCreateInput: {
    branch: "String",
    clientMutationId: "String",
    commit: "String",
    cronline: "String",
    enabled: "Boolean",
    env: "String",
    label: "String",
    message: "String",
    pipelineID: "ID!",
  },
  PipelineScheduleDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineScheduleUpdateInput: {
    branch: "String",
    clientMutationId: "String",
    commit: "String",
    cronline: "String",
    enabled: "Boolean",
    env: "String",
    id: "ID!",
    label: "String",
    message: "String",
  },
  PipelineStepsInput: {
    yaml: "String!",
  },
  PipelineTagInput: {
    label: "String!",
  },
  PipelineTeamAssignmentInput: {
    accessLevel: "PipelineAccessLevels",
    id: "ID!",
  },
  PipelineTemplateCreateInput: {
    available: "Boolean",
    clientMutationId: "String",
    configuration: "String!",
    description: "String",
    name: "String!",
    organizationId: "ID!",
  },
  PipelineTemplateDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
    organizationId: "ID!",
  },
  PipelineTemplateUpdateInput: {
    available: "Boolean",
    clientMutationId: "String",
    configuration: "String",
    description: "String",
    id: "ID!",
    name: "String",
    organizationId: "ID!",
  },
  PipelineUnarchiveInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  PipelineUpdateInput: {
    allowRebuilds: "Boolean",
    archived: "Boolean",
    branchConfiguration: "String",
    cancelIntermediateBuilds: "Boolean",
    cancelIntermediateBuildsBranchFilter: "String",
    clientMutationId: "String",
    clusterId: "ID",
    color: "String",
    defaultBranch: "String",
    defaultTimeoutInMinutes: "Int",
    description: "String",
    emoji: "String",
    id: "ID!",
    maximumTimeoutInMinutes: "Int",
    name: "String",
    nextBuildNumber: "Int",
    pipelineTemplateId: "ID",
    repository: "PipelineRepositoryInput",
    skipIntermediateBuilds: "Boolean",
    skipIntermediateBuildsBranchFilter: "String",
    steps: "PipelineStepsInput",
    tags: "[PipelineTagInput!]",
    visibility: "PipelineVisibility",
  },
  RuleCreateInput: {
    clientMutationId: "String",
    description: "String",
    organizationId: "ID!",
    type: "String!",
    value: "JSON!",
  },
  RuleDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
    organizationId: "ID!",
  },
  RuleUpdateInput: {
    clientMutationId: "String",
    description: "String",
    id: "ID!",
    organizationId: "ID!",
    value: "JSON!",
  },
  SSOProviderCreateInput: {
    clientMutationId: "String",
    digestMethod: "SSOProviderSAMLXMLSecurity",
    discloseGoogleHostedDomain: "Boolean",
    emailDomain: "String",
    emailDomainVerificationAddress: "String",
    githubOrganizationName: "String",
    googleHostedDomain: "String",
    identityProvider: "SSOProviderSAMLIdP",
    note: "String",
    organizationId: "ID!",
    pinSessionToIpAddress: "Boolean",
    sessionDurationInHours: "Int",
    signatureMethod: "SSOProviderSAMLRSAXMLSecurity",
    type: "SSOProviderTypes!",
  },
  SSOProviderDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  SSOProviderDisableInput: {
    clientMutationId: "String",
    disabledReason: "String",
    id: "ID!",
  },
  SSOProviderEnableInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  SSOProviderSAMLIdP: {
    certificate: "String",
    issuer: "String",
    metadata: "SSOProviderSAMLIdPMetadata",
    ssoURL: "String",
  },
  SSOProviderSAMLIdPMetadata: {
    url: "String",
    xml: "XML",
  },
  SSOProviderUpdateInput: {
    clientMutationId: "String",
    digestMethod: "SSOProviderSAMLXMLSecurity",
    discloseGoogleHostedDomain: "Boolean",
    emailDomain: "String",
    emailDomainVerificationAddress: "String",
    githubOrganizationName: "String",
    googleHostedDomain: "String",
    id: "ID!",
    identityProvider: "SSOProviderSAMLIdP",
    note: "String",
    pinSessionToIpAddress: "Boolean",
    sessionDurationInHours: "Int",
    signatureMethod: "SSOProviderSAMLRSAXMLSecurity",
  },
  TOTPActivateInput: {
    clientMutationId: "String",
    id: "ID!",
    token: "String!",
  },
  TOTPCreateInput: {
    clientMutationId: "String",
  },
  TOTPDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  TOTPRecoveryCodesRegenerateInput: {
    clientMutationId: "String",
    totpId: "ID!",
  },
  TeamCreateInput: {
    clientMutationId: "String",
    defaultMemberRole: "TeamMemberRole!",
    description: "String",
    isDefaultTeam: "Boolean!",
    membersCanCreatePipelines: "Boolean",
    membersCanDeletePipelines: "Boolean",
    name: "String!",
    organizationID: "ID!",
    privacy: "TeamPrivacy!",
  },
  TeamDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  TeamMemberCreateInput: {
    clientMutationId: "String",
    role: "TeamMemberRole",
    teamID: "ID!",
    userID: "ID!",
  },
  TeamMemberDeleteInput: {
    clientMutationId: "String",
    id: "ID!",
  },
  TeamMemberUpdateInput: {
    clientMutationId: "String",
    id: "ID!",
    role: "TeamMemberRole!",
  },
  TeamPipelineCreateInput: {
    accessLevel: "PipelineAccessLevels",
    clientMutationId: "String",
    pipelineID: "ID!",
    teamID: "ID!",
  },
  TeamPipelineDeleteInput: {
    clientMutationId: "String",
    force: "Boolean",
    id: "ID!",
  },
  TeamPipelineUpdateInput: {
    accessLevel: "PipelineAccessLevels!",
    clientMutationId: "String",
    id: "ID!",
  },
  TeamRegistryCreateInput: {
    accessLevel: "RegistryAccessLevels",
    clientMutationId: "String",
    registryID: "ID!",
    teamID: "ID!",
  },
  TeamRegistryDeleteInput: {
    clientMutationId: "String",
    force: "Boolean",
    id: "ID!",
  },
  TeamRegistryUpdateInput: {
    accessLevel: "RegistryAccessLevels!",
    clientMutationId: "String",
    id: "ID!",
  },
  TeamSuiteCreateInput: {
    accessLevel: "SuiteAccessLevels",
    clientMutationId: "String",
    suiteID: "ID!",
    teamID: "ID!",
  },
  TeamSuiteDeleteInput: {
    clientMutationId: "String",
    force: "Boolean",
    id: "ID!",
  },
  TeamSuiteUpdateInput: {
    accessLevel: "SuiteAccessLevels!",
    clientMutationId: "String",
    id: "ID!",
  },
  TeamUpdateInput: {
    clientMutationId: "String",
    defaultMemberRole: "TeamMemberRole!",
    description: "String",
    id: "ID!",
    isDefaultTeam: "Boolean!",
    membersCanCreatePipelines: "Boolean",
    membersCanDeletePipelines: "Boolean",
    name: "String!",
    privacy: "TeamPrivacy",
  },
}

// We use a dummy conditional type that involves GenericType to defer the compiler's inference of
// any possible variables nested in this type. This addresses a problem where variables are
// inferred with type unknown
type ExactArgNames<GenericType, Constraint> = GenericType extends never ? never
  : GenericType extends Variable<any, any, any> ? GenericType
  : [Constraint] extends [$Atomic | CustomScalar<any>] ? GenericType
  : Constraint extends ReadonlyArray<infer InnerConstraint>
    ? GenericType extends ReadonlyArray<infer Inner> ? ReadonlyArray<ExactArgNames<Inner, InnerConstraint>>
    : GenericType
  :
    & GenericType
    & {
      [Key in keyof GenericType]: Key extends keyof Constraint ? ExactArgNames<GenericType[Key], Constraint[Key]>
        : never
    }
