package com.formulai.auth.unit;

import com.formulai.auth.config.JwtConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.spec.InvalidKeySpecException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class JwtConfigTest {
    @Mock
    private Resource privateKeyResource;

    @InjectMocks
    private JwtConfig jwtConfig;

    @Test
    void shouldCreatePrivateKeyFromValidResource() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        // given
        String privateKeyContent = "-----BEGIN PRIVATE KEY-----\n" +
                "MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCZkvHclVz/3d2t\n" +
                "AQBSXGlKWdkGCAbs42n0d9m2/P6zRUpo1lFbvbHUM/yEs2RkTJXXFFMbC37DSQzt\n" +
                "ZWZPwnLxIcuYmK5UF1h2RNBtI7iv6mv0wg1VXG1jFQRWxMDNf5Zkh7WK3w02uzlR\n" +
                "kLW51r+n/6MHtOqz7FD0lHiurJkSgpy5ayTuIcyZbvLz0xMSovaX83snxn22xsZS\n" +
                "eLV0JsX0S2OQFkBjYmfExGCWoW1SgbKw1xDNqMkHqDvrdxRz8/Pyns6G41808ugO\n" +
                "klf6YYwld6BhSf9GZi4S2vodohASWGp40nuLutzq/y6TUL/tEy+XxS+ZugKtgl5c\n" +
                "5LDrgJV7AgMBAAECggEAA0HYm2MXm92qy/aPeS+4k/kf3z7gVrnkD2lTVsw64rZ/\n" +
                "g4W4KAf385Y+rtnXMUFmlC88LACsaZvtCEP0TZDEO1UKKmxilioAmFGRUh9F1YVV\n" +
                "UNWkzsCtGULi2qxFopYoLG2sbguZDiYeaxp0oEJrwjZr0MgHilViyi0z+hBzFq9i\n" +
                "FbJglTgnKafADxjS64afN+3iJ4WMZEseR6MEPsqxdj9i7Mb1n0LAWZIRLkYK7cMZ\n" +
                "uunW+Y+FoQ3zeILYC2Z0kMzC1UmWAmJcc7V7rtXCr/nhtJNvAT8aQ5TijoU58nLh\n" +
                "GisWzNWkOVC2q6ZuBC9Lxdj2QkLzVDHd+Bb5sgmdcQKBgQDBVRKqrFfeXl39mQdZ\n" +
                "rsIN66zndstvtNOuZjNC939QXFFlmMwIfSZqokCfMnNB2UfHe9ypiiquBT6bZyxG\n" +
                "viPfYJHLp8fGEfMVO4eEY++LdQSYa0F3WLLQUxniIK46cTvcQCxeE6lbnuz1oJol\n" +
                "lEcSwjc4rhMCmaMKvkvbHLWSxwKBgQDLWq78ubvc9C0BWqIZGHO91+flktTDQzyo\n" +
                "LNx9kpT+0C1YLjHVgrZZ5gd8FGR2puVK+WKqabWBq+3EKUDBgoVQAuN0rmi2PdH+\n" +
                "pQLVvTldj4/SGS9I0PMuG0K5zRuHmZeqZBQSbsdF0T1STATA6PJtqNl0q1Zoeg1W\n" +
                "8Uz+4DtzrQKBgQC9/7R7pSopsIYgj37oxVWSxrXDOD1QR97s+yWPv5oQSNn5xcNm\n" +
                "6E+T5mcpzTP2V+oyAulmeRHeuerAYRHjaEPq6IYAJqCvaL6DdGCHXItze4oLnQTW\n" +
                "nIYHNFQwpjtz1gqlNzAjOKFtGG/6KV60Zde/eL06Z+Do4kKYcVItQTa0ywKBgQCX\n" +
                "K3ewGiakz8PxIL4l576K30jdqfSOn5ok7wyOMPygHIPI7LZRIZWLaOwhektgxRrp\n" +
                "TFDjnCe5GOVtELm54NxXqX4LTGg9KeHE6kgcOkm92q4wolY7TFGq8cr9spMHj89m\n" +
                "dHVTapSquyxZ1HcoLUOi74WQLJrUmf72pfT1+B1aFQKBgQCvBEQWilU0a3TE6MAp\n" +
                "2gpmcZS9Qm32QRvgRDlodDox4+fPDc6CQ8J0FD/kbOl80DJup+Ye071AtN/MjKSw\n" +
                "sYKDQ4ZWuELZRRDCkftCmsK6tLPEuOME1KvSZ5FXuZjeecZE4xpJPBU4anDRb28o\n" +
                "8wkJ3VJI9JA66Fr3bNDHNxdNEw==\n" +
                "-----END PRIVATE KEY-----";

        when(privateKeyResource.getContentAsString(StandardCharsets.UTF_8)).thenReturn(privateKeyContent);

        // when
        PrivateKey result = jwtConfig.privateKey();

        // then
        assertNotNull(result);
        assertEquals("RSA", result.getAlgorithm());
    }

    @Test
    void shouldThrowExceptionWhenKeyIsInvalid() throws IOException {
        // given
        String invalidKey = "-----BEGIN PRIVATE KEY-----\nINVALIDKEY\n-----END PRIVATE KEY-----";
        when(privateKeyResource.getContentAsString(StandardCharsets.UTF_8)).thenReturn(invalidKey);

        // when & then
        assertThrows(InvalidKeySpecException.class, () -> jwtConfig.privateKey());
    }

    @Test
    void shouldReturnConfiguredExpirationHours() {
        // Given
        ReflectionTestUtils.setField(jwtConfig, "expirationHours", 24);

        // When
        int result = jwtConfig.jwtExpirationHours();

        // Then
        assertEquals(24, result);
    }
}
