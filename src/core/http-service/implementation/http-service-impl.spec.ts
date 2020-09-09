import {CsHttpRequestType, CsHttpSerializer, CsHttpService, CsRequest, CsResponse} from '../interface';
import {Container} from 'inversify';
import {InjectionTokens} from '../../../injection-tokens';
import {HttpClient} from './http-client-adapters/http-client';
import {HttpServiceImpl} from './http-service-impl';
import {of, throwError} from 'rxjs';
import {BearerTokenInjectRequestInterceptor} from './interceptors/bearer-token-inject-request-interceptor';
import {UserTokenInjectRequestInterceptor} from './interceptors/user-token-inject-request-interceptor';
import {CsHttpClientError, CsHttpServerError} from '../errors';

describe('HttpServiceImpl', () => {
    let httpService: CsHttpService;
    const mockHttpClient: Partial<HttpClient> = {
        addHeaders: (headers: { [p: string]: string }) => {
        },
        setSerializer: jest.fn((httpSerializer: CsHttpSerializer) => {
        })
    };

    beforeAll(() => {
        const container = new Container();
        container.bind<Container>(InjectionTokens.CONTAINER).toConstantValue(container);
        container.bind<HttpClient>(InjectionTokens.core.HTTP_ADAPTER).toConstantValue(mockHttpClient as HttpClient);

        container.bind<string>(InjectionTokens.core.api.HOST).toConstantValue('SAMPLE_HOST');
        container.bind<string>(InjectionTokens.core.global.CHANNEL_ID).toConstantValue('SAMPLE_CHANNEL_ID');
        container.bind<string>(InjectionTokens.core.global.DEVICE_ID).toConstantValue('SAMPLE_DEVICE_ID');
        container.bind<string>(InjectionTokens.core.global.PRODUCER_ID).toConstantValue('SAMPLE_PRODUCER_ID');

        container.bind<string>(InjectionTokens.core.api.authentication.BEARER_TOKEN).toConstantValue('SAMPLE_BEARER_TOKEN');
        container.bind<string>(InjectionTokens.core.api.authentication.USER_TOKEN).toConstantValue('SAMPLE_USER_TOKEN');
        container.bind<string>(InjectionTokens.core.api.authentication.MANAGED_USER_TOKEN).toConstantValue('SAMPLE_MANAGED_USER_TOKEN');

        container.bind<CsHttpService>(InjectionTokens.core.HTTP_SERVICE).to(HttpServiceImpl).inSingletonScope();

        httpService = container.get(InjectionTokens.core.HTTP_SERVICE);
    });

    beforeEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it('it should be able to retrieve and instance from the container', () => {
        expect(httpService).toBeTruthy();
    });

    it('should add BearerTokenInjectRequestInterceptor when requesting with bearerToken flag', (done) => {
        // arrange
        const mockResponse = new CsResponse();
        mockResponse.body = {};
        mockResponse.responseCode = 200;
        mockHttpClient.get = jest.fn(() => of(mockResponse));

        const apiRequest: CsRequest = new CsRequest.Builder()
            .withType(CsHttpRequestType.GET)
            .withPath('/some_path')
            .withBearerToken(true)
            .build();

        // act
        httpService.fetch(apiRequest).subscribe(() => {
            // assert
            expect(apiRequest.requestInterceptors.length).toBeTruthy();
            expect(apiRequest.requestInterceptors[0] instanceof BearerTokenInjectRequestInterceptor).toBeTruthy();
            done();
        });
    });

    it('should add UserTokenInjectRequestInterceptor when requesting with userToken flag', (done) => {
        // arrange
        const mockResponse = new CsResponse();
        mockResponse.body = {};
        mockResponse.responseCode = 200;
        mockHttpClient.post = jest.fn(() => of(mockResponse));

        const apiRequest: CsRequest = new CsRequest.Builder()
            .withType(CsHttpRequestType.POST)
            .withPath('/some_path')
            .withUserToken(true)
            .build();

        // act
        httpService.fetch(apiRequest).subscribe(() => {
            // assert
            expect(apiRequest.requestInterceptors.length).toBeTruthy();
            expect(apiRequest.requestInterceptors[0] instanceof UserTokenInjectRequestInterceptor).toBeTruthy();
            done();
        });
    });

    it('should be able to request with CsHttpSerializer.URLENCODED serializer', (done) => {
        // arrange
        const mockResponse = new CsResponse();
        mockResponse.body = {};
        mockResponse.responseCode = 200;
        mockHttpClient.patch = jest.fn(() => of(mockResponse));

        const apiRequest: CsRequest = new CsRequest.Builder()
            .withType(CsHttpRequestType.PATCH)
            .withPath('/some_path')
            .withSerializer(CsHttpSerializer.URLENCODED)
            .withUserToken(true)
            .build();

        // act
        httpService.fetch(apiRequest).subscribe(() => {
            // assert
            expect(apiRequest.requestInterceptors.length).toBeTruthy();
            expect(mockHttpClient.setSerializer).toHaveBeenCalledWith(CsHttpSerializer.URLENCODED);
            done();
        });
    });

    it('should be not be able to request with unknown HTTP request type', (done) => {
        // arrange
        const apiRequest: CsRequest = new CsRequest.Builder()
            .withType('INVALID_TYPE')
            .withPath('/some_path')
            .withSerializer(CsHttpSerializer.URLENCODED)
            .withUserToken(true)
            .build();

        // act
        httpService.fetch(apiRequest).subscribe(() => {
            fail();
        }, (e: Error) => {
            // assert
            expect(e.message).toEqual('Unsupported type');
            done();
        });
    });

    describe('when adding interceptors per request', () => {
        it('should be able to add own request interceptors', (done) => {
            // arrange
            const mockResponse = new CsResponse();
            mockResponse.body = {};
            mockResponse.responseCode = 200;
            mockHttpClient.get = jest.fn(() => of(mockResponse));

            const customInterceptor = {
                interceptRequest: (request: CsRequest) => {
                    console.log('custom request interceptor');
                    return of(request);
                }
            };

            const apiRequest: CsRequest = new CsRequest.Builder()
                .withType(CsHttpRequestType.GET)
                .withPath('/some_path')
                .withUserToken(true)
                .withRequestInterceptor(customInterceptor)
                .build();

            // act
            httpService.fetch(apiRequest).subscribe(() => {
                // assert
                expect(apiRequest.requestInterceptors.length).toBeTruthy();
                expect(apiRequest.requestInterceptors[0]).toBe(customInterceptor);
                done();
            });
        });

        it('should be able to add own response interceptors for success responses', (done) => {
            // arrange
            const mockResponse = new CsResponse();
            mockResponse.body = {};
            mockResponse.responseCode = 200;
            mockHttpClient.get = jest.fn(() => of(mockResponse));

            const customInterceptor = {
                interceptResponse: (request: CsRequest, response: CsResponse) => {
                    console.log('custom response interceptor');
                    return of(response);
                }
            };

            const apiRequest: CsRequest = new CsRequest.Builder()
                .withType(CsHttpRequestType.GET)
                .withPath('/some_path')
                .withUserToken(true)
                .withResponseInterceptor(customInterceptor)
                .build();

            // act
            httpService.fetch(apiRequest).subscribe(() => {
                // assert
                expect(apiRequest.responseInterceptors.length).toBeTruthy();
                expect(apiRequest.responseInterceptors[0]).toBe(customInterceptor);
                done();
            });
        });

        describe('when adding own response interceptors for error responses', () => {
            it('should be able to succeed after intercept', (done) => {
                // arrange
                const mockResponse = new CsResponse();
                mockResponse.body = {};
                mockResponse.responseCode = 400;
                mockHttpClient.get = jest.fn(() => throwError(new CsHttpClientError('custom error', mockResponse)));

                const mockSuccessResponse = new CsResponse();
                mockSuccessResponse.body = {};
                mockSuccessResponse.responseCode = 200;

                const customInterceptor = {
                    interceptResponse: (request: CsRequest, response: CsResponse) => {
                        return of(mockSuccessResponse);
                    }
                };

                const apiRequest: CsRequest = new CsRequest.Builder()
                    .withType(CsHttpRequestType.GET)
                    .withPath('/some_path')
                    .withUserToken(true)
                    .withResponseInterceptor(customInterceptor)
                    .build();

                // act
                httpService.fetch(apiRequest).subscribe((response) => {
                    // assert
                    expect(apiRequest.responseInterceptors.length).toBeTruthy();
                    expect(apiRequest.responseInterceptors[0]).toBe(customInterceptor);
                    expect(response).toBe(mockSuccessResponse);
                    done();
                }, (e) => {
                    console.error(e);
                    fail(e);
                    done();
                });
            });

            it('should be able to fail gracefully after intercept and retry', (done) => {
                // arrange
                const mockResponse = new CsResponse();
                mockResponse.body = {};
                mockResponse.responseCode = 400;
                mockHttpClient.get = jest.fn(() => throwError(new CsHttpClientError('custom error', mockResponse)));

                const mockErrorResponse = new CsResponse();
                mockErrorResponse.body = {};
                mockErrorResponse.responseCode = 405;

                const customInterceptor = {
                    interceptResponse: (request: CsRequest, response: CsResponse) => {
                        return throwError(new CsHttpClientError('custom error', mockErrorResponse));
                    }
                };

                const apiRequest: CsRequest = new CsRequest.Builder()
                    .withType(CsHttpRequestType.GET)
                    .withPath('/some_path')
                    .withUserToken(true)
                    .withResponseInterceptor(customInterceptor)
                    .build();

                // act
                httpService.fetch(apiRequest).subscribe(() => {
                    // assert
                    fail();
                    done();
                }, (e) => {
                    console.error(e);
                    expect(apiRequest.responseInterceptors.length).toBeTruthy();
                    expect(apiRequest.responseInterceptors[0]).toBe(customInterceptor);
                    expect(CsHttpClientError.isInstance(e)).toBeTruthy();
                    expect(e.response).toBe(mockErrorResponse);
                    done();
                });
            });

            it('should be able to fail gracefully after intercept and ignore for a CsHttpClientError', (done) => {
                // arrange
                const mockResponse = new CsResponse();
                mockResponse.body = {};
                mockResponse.responseCode = 400;
                mockHttpClient.get = jest.fn(() => throwError(new CsHttpClientError('custom error', mockResponse)));

                const mockErrorResponse = new CsResponse();
                mockErrorResponse.body = {};
                mockErrorResponse.responseCode = 405;

                const customInterceptor = {
                    interceptResponse: (request: CsRequest, response: CsResponse) => {
                        return of(mockErrorResponse);
                    }
                };

                const apiRequest: CsRequest = new CsRequest.Builder()
                    .withType(CsHttpRequestType.GET)
                    .withPath('/some_path')
                    .withUserToken(true)
                    .withResponseInterceptor(customInterceptor)
                    .build();

                // act
                httpService.fetch(apiRequest).subscribe(() => {
                    // assert
                    fail();
                    done();
                }, (e) => {
                    console.error(e);
                    expect(apiRequest.responseInterceptors.length).toBeTruthy();
                    expect(apiRequest.responseInterceptors[0]).toBe(customInterceptor);
                    expect(CsHttpClientError.isInstance(e)).toBeTruthy();
                    expect(e.response).toBe(mockErrorResponse);
                    done();
                });
            });

            it('should be able to fail gracefully after intercept and ignore for a CsHttpServerError', (done) => {
                // arrange
                const mockResponse = new CsResponse();
                mockResponse.body = {};
                mockResponse.responseCode = 500;
                mockHttpClient.get = jest.fn(() => throwError(new CsHttpServerError('custom error', mockResponse)));

                const mockErrorResponse = new CsResponse();
                mockErrorResponse.body = {};
                mockErrorResponse.responseCode = 505;

                const customInterceptor = {
                    interceptResponse: (request: CsRequest, response: CsResponse) => {
                        return of(mockErrorResponse);
                    }
                };

                const apiRequest: CsRequest = new CsRequest.Builder()
                    .withType(CsHttpRequestType.GET)
                    .withPath('/some_path')
                    .withUserToken(true)
                    .withResponseInterceptor(customInterceptor)
                    .build();

                // act
                httpService.fetch(apiRequest).subscribe(() => {
                    // assert
                    fail();
                    done();
                }, (e) => {
                    console.error(e);
                    expect(apiRequest.responseInterceptors.length).toBeTruthy();
                    expect(apiRequest.responseInterceptors[0]).toBe(customInterceptor);
                    expect(CsHttpServerError.isInstance(e)).toBeTruthy();
                    expect(e.response).toBe(mockErrorResponse);
                    done();
                });
            });
        });
    });

    describe('when replacing default interceptors', () => {
        it('should be able to add own request interceptors', (done) => {
            // arrange
            const mockResponse = new CsResponse();
            mockResponse.body = {};
            mockResponse.responseCode = 200;
            mockHttpClient.get = jest.fn(() => of(mockResponse));

            const customInterceptor = {
                interceptRequest: jest.fn((request: CsRequest) => {
                    console.log('custom request interceptor');
                    return of(request);
                })
            };

            httpService.requestInterceptors = [customInterceptor];
            httpService.responseInterceptors = [];

            const apiRequest: CsRequest = new CsRequest.Builder()
                .withType(CsHttpRequestType.GET)
                .withPath('/some_path')
                .withUserToken(true)
                .build();

            // act
            httpService.fetch(apiRequest).subscribe(() => {
                // assert
                expect(httpService.requestInterceptors).toEqual(expect.arrayContaining([customInterceptor]));
                expect(customInterceptor.interceptRequest).toHaveBeenCalled();
                done();
            });
        });

        it('should be able to add own response interceptors for success responses', (done) => {
            // arrange
            const mockResponse = new CsResponse();
            mockResponse.body = {};
            mockResponse.responseCode = 200;
            mockHttpClient.delete = jest.fn(() => of(mockResponse));

            const customInterceptor = {
                interceptResponse: jest.fn((request: CsRequest, response: CsResponse) => {
                    console.log('custom response interceptor');
                    return of(response);
                })
            };

            httpService.requestInterceptors = [];
            httpService.responseInterceptors = [customInterceptor];

            const apiRequest: CsRequest = new CsRequest.Builder()
                .withType(CsHttpRequestType.DELETE)
                .withPath('/some_path')
                .withUserToken(true)
                .build();

            // act
            httpService.fetch(apiRequest).subscribe(() => {
                // assert
                expect(httpService.responseInterceptors).toEqual(expect.arrayContaining([customInterceptor]));
                expect(customInterceptor.interceptResponse).toHaveBeenCalled();
                done();
            });
        });
    });
});
