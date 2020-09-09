import {
    CsHttpRequestType,
    CsHttpResponseCode,
    CsHttpService,
    CsRequest,
    CsRequestInterceptor,
    CsResponse,
    CsResponseInterceptor
} from '../interface';
import {from, Observable} from 'rxjs';
import {Container, inject, injectable} from 'inversify';
import {InjectionTokens} from '../../../injection-tokens';
import {HttpClient} from './http-client-adapters/http-client';
import {BearerTokenInjectRequestInterceptor} from './interceptors/bearer-token-inject-request-interceptor';
import {UserTokenInjectRequestInterceptor} from './interceptors/user-token-inject-request-interceptor';
import {CsHttpClientError, CsHttpServerError} from '../errors';

@injectable()
export class HttpServiceImpl implements CsHttpService {
    private _requestInterceptors: CsRequestInterceptor[] = [];
    private _responseInterceptors: CsResponseInterceptor[] = [];

    private _bearerTokenInjectRequestInterceptor?: BearerTokenInjectRequestInterceptor;
    get bearerTokenInjectRequestInterceptor(): BearerTokenInjectRequestInterceptor {
        if (!this._bearerTokenInjectRequestInterceptor) {
            this._bearerTokenInjectRequestInterceptor = new BearerTokenInjectRequestInterceptor(this.container);
        }
        return this._bearerTokenInjectRequestInterceptor;
    }

    private _userTokenInjectRequestInterceptor?: UserTokenInjectRequestInterceptor;
    get userTokenInjectRequestInterceptor(): UserTokenInjectRequestInterceptor {
        if (!this._userTokenInjectRequestInterceptor) {
            this._userTokenInjectRequestInterceptor = new UserTokenInjectRequestInterceptor(this.container);
        }
        return this._userTokenInjectRequestInterceptor;
    }

    get host(): string {
        return this.container.get(InjectionTokens.core.api.HOST);
    }

    get channelId(): string {
        return this.container.get(InjectionTokens.core.global.CHANNEL_ID);
    }

    get deviceId(): string {
        return this.container.get(InjectionTokens.core.global.DEVICE_ID);
    }

    get producerId(): string {
        return this.container.get(InjectionTokens.core.global.PRODUCER_ID);
    }

    constructor(
        @inject(InjectionTokens.CONTAINER) private container: Container,
        @inject(InjectionTokens.core.HTTP_ADAPTER) private http: HttpClient
    ) {
    }

    get requestInterceptors(): CsRequestInterceptor[] {
        return this._requestInterceptors;
    }

    set requestInterceptors(value: CsRequestInterceptor[]) {
        this._requestInterceptors = value;
    }

    get responseInterceptors(): CsResponseInterceptor[] {
        return this._responseInterceptors;
    }

    set responseInterceptors(value: CsResponseInterceptor[]) {
        this._responseInterceptors = value;
    }

    public fetch<T = any>(request: CsRequest): Observable<CsResponse<T>> {
        this.addGlobalHeader();

        this.buildInterceptorsFromRequest(request);

        const response: Promise<CsResponse<T>> = (async () => {
            let localResponse: CsResponse<T>;
            request = await this.interceptRequest(request);

            try {
                switch (request.type) {
                    case CsHttpRequestType.GET:
                        localResponse = await this.http.get(
                            request.host || this.host, request.path, request.headers, request.parameters
                        ).toPromise();
                        break;
                    case CsHttpRequestType.PATCH:
                        localResponse = await this.http.patch(
                            request.host || this.host, request.path, request.headers, request.body
                        ).toPromise();
                        break;
                    case CsHttpRequestType.POST: {
                        localResponse = await this.http.post(
                            request.host || this.host, request.path, request.headers, request.body
                        ).toPromise();
                        break;
                    }
                    case CsHttpRequestType.DELETE:
                        localResponse = await this.http.delete(
                            request.host || this.host, request.path, request.headers, request.parameters
                        ).toPromise();
                        break;
                    default:
                        throw new Error('Unsupported type');
                }

                return await this.interceptResponse(request, localResponse);
            } catch (e) {
                const wrapError = (res: CsResponse<T>) => {
                    if (res.responseCode >= 400 && res.responseCode <= 499) {
                        throw new CsHttpClientError(`
                            ${request.host + request.path} -
                            ${res.errorMesg || ''}
                        `, res);
                    } else if (res.responseCode >= 500 && res.responseCode <= 599) {
                        throw new CsHttpServerError(`
                            ${request.host + request.path} -
                            ${res.errorMesg || ''}
                        `, res);
                    }
                    return res;
                };
                if (CsHttpClientError.isInstance(e) || CsHttpServerError.isInstance(e)) {
                    try {
                        localResponse = await this.interceptResponse(request, e.response);
                        return wrapError(localResponse);
                    } catch (e) {
                        if (e.responseCode) {
                            return wrapError(e);
                        }
                        throw e;
                    }
                } else {
                    throw e;
                }
            }

        })();

        return from(response as Promise<CsResponse<T>>);
    }

    private addGlobalHeader() {
        const header = {
            'X-Channel-Id': this.channelId,
            'X-App-Id': this.producerId,
            'X-Device-Id': this.deviceId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        };
        this.http.addHeaders(header);
    }

    private async interceptRequest(request: CsRequest): Promise<CsRequest> {
        const interceptors = [
            ...this.requestInterceptors,
            ...request.requestInterceptors
        ];
        for (const interceptor of interceptors) {
            request = await interceptor.interceptRequest(request).toPromise();
        }

        return request;
    }

    private async interceptResponse(request: CsRequest, response: CsResponse): Promise<CsResponse> {
        const interceptors = [
            ...this.responseInterceptors,
            ...request.responseInterceptors
        ];
        for (const interceptor of interceptors) {
            response = await interceptor.interceptResponse(request, response).toPromise();
        }

        if (response.responseCode !== CsHttpResponseCode.HTTP_SUCCESS) {
            throw response;
        }

        return response;
    }

    private buildInterceptorsFromRequest(request: CsRequest) {
        if (request.withBearerToken && request.requestInterceptors.indexOf(this.bearerTokenInjectRequestInterceptor) === -1) {
            request.requestInterceptors.push(this.bearerTokenInjectRequestInterceptor);
        }

        if (request.withUserToken && request.requestInterceptors.indexOf(this.userTokenInjectRequestInterceptor) === -1) {
            request.requestInterceptors.push(this.userTokenInjectRequestInterceptor);
        }

        this.http.setSerializer(request.serializer);
    }
}
