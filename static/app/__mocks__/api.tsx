import isEqual from 'lodash/isEqual';

import * as ApiNamespace from 'app/api';

const RealApi: typeof ApiNamespace = jest.requireActual('app/api');

export class Request {}

export const initApiClientErrorHandling = RealApi.initApiClientErrorHandling;

const respond = (isAsync: boolean, fn?: Function, ...args: any[]): void => {
  if (!fn) {
    return;
  }

  if (isAsync) {
    setTimeout(() => fn(...args), 1);
    return;
  }

  fn(...args);
};

type FunctionCallback<Args extends any[] = any[]> = (...args: Args) => void;

/**
 * Callables for matching requests based on arbitrary conditions.
 */
interface MatchCallable {
  (url: string, options: ApiNamespace.RequestOptions): boolean;
}

type ResponseType = ApiNamespace.ResponseMeta & {
  url: string;
  statusCode: number;
  method: string;
  callCount: 0;
  match: MatchCallable[];
  body: any;
  headers: Record<string, string>;
};

type MockResponse = [resp: ResponseType, mock: jest.Mock];

/**
 * Compare two records. `want` is all the entries we want to have the same value in `check`
 */
function compareRecord(want: Record<string, any>, check: Record<string, any>): boolean {
  for (const entry of Object.entries(want)) {
    const [key, value] = entry;
    if (!isEqual(check[key], value)) {
      return false;
    }
  }
  return true;
}

class Client implements ApiNamespace.Client {
  static mockResponses: MockResponse[] = [];

  static mockAsync = false;

  static clearMockResponses() {
    Client.mockResponses = [];
  }

  /**
   * Create a query string match callable.
   *
   * Only keys/values defined in `query` are checked.
   */
  static matchQuery(query: Record<string, any>): MatchCallable {
    const queryMatcher: MatchCallable = (_url, options) => {
      return compareRecord(query, options.query ?? {});
    };

    return queryMatcher;
  }

  /**
   * Create a data match callable.
   *
   * Only keys/values defined in `data` are checked.
   */
  static matchData(data: Record<string, any>): MatchCallable {
    const dataMatcher: MatchCallable = (_url, options) => {
      return compareRecord(data, options.data ?? {});
    };

    return dataMatcher;
  }

  // Returns a jest mock that represents Client.request calls
  static addMockResponse(response: Partial<ResponseType>) {
    const mock = jest.fn();

    Client.mockResponses.unshift([
      {
        url: '',
        status: 200,
        statusCode: 200,
        statusText: 'OK',
        responseText: '',
        responseJSON: '',
        body: '',
        method: 'GET',
        callCount: 0,
        match: [],
        ...response,
        headers: response.headers ?? {},
        getResponseHeader: (key: string) => response.headers?.[key] ?? null,
      },
      mock,
    ]);

    return mock;
  }

  static findMockResponse(url: string, options: Readonly<ApiNamespace.RequestOptions>) {
    return Client.mockResponses.find(([response]) => {
      if (url !== response.url) {
        return false;
      }
      if ((options.method || 'GET') !== response.method) {
        return false;
      }
      return response.match.every(matcher => matcher(url, options));
    });
  }

  activeRequests: Record<string, ApiNamespace.Request> = {};
  baseUrl = '';

  uniqueId() {
    return '123';
  }

  /**
   * In the real client, this clears in-flight responses. It's NOT
   * clearMockResponses. You probably don't want to call this from a test.
   */
  clear() {}

  wrapCallback<T extends any[]>(
    _id: string,
    func: FunctionCallback<T> | undefined,
    _cleanup: boolean = false
  ) {
    return (...args: T) => {
      // @ts-expect-error
      if (RealApi.hasProjectBeenRenamed(...args)) {
        return;
      }
      respond(Client.mockAsync, func, ...args);
    };
  }

  requestPromise(
    path: string,
    {
      includeAllArgs,
      ...options
    }: {includeAllArgs?: boolean} & Readonly<ApiNamespace.RequestOptions> = {}
  ): any {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          includeAllArgs ? resolve([data, ...args]) : resolve(data);
        },
        error: (error, ..._args) => {
          reject(error);
        },
      });
    });
  }

  // XXX(ts): We type the return type for requestPromise and request as `any`. Typically these woul

  request(url: string, options: Readonly<ApiNamespace.RequestOptions> = {}): any {
    const [response, mock] = Client.findMockResponse(url, options) || [
      undefined,
      undefined,
    ];

    if (!response || !mock) {
      // Endpoints need to be mocked
      const err = new Error(
        `No mocked response found for request: ${options.method || 'GET'} ${url}`
      );

      // Mutate stack to drop frames since test file so that we know where in the test
      // this needs to be mocked
      const lines = err.stack?.split('\n');
      const startIndex = lines?.findIndex(line => line.includes('tests/js/spec'));
      err.stack = ['\n', lines?.[0], ...(lines?.slice(startIndex) ?? [])].join('\n');

      // Throwing an error here does not do what we want it to do....
      // Because we are mocking an API client, we generally catch errors to show
      // user-friendly error messages, this means in tests this error gets gobbled
      // up and developer frustration ensues. Use `setTimeout` to get around this
      setTimeout(() => {
        throw err;
      });
    } else {
      // has mocked response

      // mock gets returned when we add a mock response, will represent calls to api.request
      mock(url, options);

      const body =
        typeof response.body === 'function' ? response.body(url, options) : response.body;

      if (![200, 202].includes(response.statusCode)) {
        response.callCount++;

        const errorResponse = Object.assign(
          {
            status: response.statusCode,
            responseText: JSON.stringify(body),
            responseJSON: body,
          },
          {
            overrideMimeType: () => {},
            abort: () => {},
            then: () => {},
            error: () => {},
          },
          new XMLHttpRequest()
        );

        this.handleRequestError(
          {
            id: '1234',
            path: url,
            requestOptions: options,
          },
          errorResponse as any,
          'error',
          'error'
        );
      } else {
        response.callCount++;
        respond(
          Client.mockAsync,
          options.success,
          body,
          {},
          {
            getResponseHeader: (key: string) => response.headers[key],
            statusCode: response.statusCode,
            status: response.statusCode,
          }
        );
      }
    }

    respond(Client.mockAsync, options.complete);
  }

  handleRequestError = RealApi.Client.prototype.handleRequestError;
}

export {Client};
