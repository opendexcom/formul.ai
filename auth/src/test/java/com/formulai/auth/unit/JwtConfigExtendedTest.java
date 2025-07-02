package com.formulai.auth.unit;

import com.formulai.auth.config.JwtConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class JwtConfigExtendedTest {

    @Test
    void shouldHandleInvalidPrivateKeyFormat() {
        // given
        JwtConfig jwtConfig = new JwtConfig();
        ReflectionTestUtils.setField(jwtConfig, "privateKey", "Not a valid private key");

        // when & then
        assertThrows(InvalidKeySpecException.class, jwtConfig::privateKey);
    }

    @Test
    void shouldHandleInvalidPublicKeyFormat() {
        // given
        JwtConfig jwtConfig = new JwtConfig();
        ReflectionTestUtils.setField(jwtConfig, "publicKey", "Not a valid public key");

        // when & then
        assertThrows(InvalidKeySpecException.class, jwtConfig::publicKey);
    }

    @Test
    void shouldHandleEmptyPrivateKey() {
        // given
        JwtConfig jwtConfig = new JwtConfig();
        ReflectionTestUtils.setField(jwtConfig, "privateKey", "");

        // when & then
        assertThrows(InvalidKeySpecException.class, jwtConfig::privateKey);
    }

    @Test
    void shouldHandleEmptyPublicKey() {
        // given
        JwtConfig jwtConfig = new JwtConfig();
        ReflectionTestUtils.setField(jwtConfig, "publicKey", "");

        // when & then
        assertThrows(InvalidKeySpecException.class, jwtConfig::publicKey);
    }

    @Test
    void shouldHandleEscapedNewlines() throws NoSuchAlgorithmException, InvalidKeySpecException {
        // given
        String privateKeyWithEscapedNewlines = "-----BEGIN PRIVATE KEY-----\\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCZkvHclVz/3d2t\\nAQBSXGlKWdkGCAbs42n0d9m2/P6zRUpo1lFbvbHUM/yEs2RkTJXXFFMbC37DSQzt\\nZWZPwnLxIcuYmK5UF1h2RNBtI7iv6mv0wg1VXG1jFQRWxMDNf5Zkh7WK3w02uzlR\\nkLW51r+n/6MHtOqz7FD0lHiurJkSgpy5ayTuIcyZbvLz0xMSovaX83snxn22xsZS\\neLV0JsX0S2OQFkBjYmfExGCWoW1SgbKw1xDNqMkHqDvrdxRz8/Pyns6G41808ugO\\nklf6YYwld6BhSf9GZi4S2vodohASWGp40nuLutzq/y6TUL/tEy+XxS+ZugKtgl5c\\n5LDrgJV7AgMBAAECggEAA0HYm2MXm92qy/aPeS+4k/kf3z7gVrnkD2lTVsw64rZ/\\ng4W4KAf385Y+rtnXMUFmlC88LACsaZvtCEP0TZDEO1UKKmxilioAmFGRUh9F1YVV\\nUNWkzsCtGULi2qxFopYoLG2sbguZDiYeaxp0oEJrwjZr0MgHilViyi0z+hBzFq9i\\nFbJglTgnKafADxjS64afN+3iJ4WMZEseR6MEPsqxdj9i7Mb1n0LAWZIRLkYK7cMZ\\nuunW+Y+FoQ3zeILYC2Z0kMzC1UmWAmJcc7V7rtXCr/nhtJNvAT8aQ5TijoU58nLh\\nGisWzNWkOVC2q6ZuBC9Lxdj2QkLzVDHd+Bb5sgmdcQKBgQDBVRKqrFfeXl39mQdZ\\nrsIN66zndstvtNOuZjNC939QXFFlmMwIfSZqokCfMnNB2UfHe9ypiiquBT6bZyxG\\nviPfYJHLp8fGEfMVO4eEY++LdQSYa0F3WLLQUxniIK46cTvcQCxeE6lbnuz1oJol\\nlEcSwjc4rhMCmaMKvkvbHLWSxwKBgQDLWq78ubvc9C0BWqIZGHO91+flktTDQzyo\\nLNx9kpT+0C1YLjHVgrZZ5gd8FGR2puVK+WKqabWBq+3EKUDBgoVQAuN0rmi2PdH+\\npQLVvTldj4/SGS9I0PMuG0K5zRuHmZeqZBQSbsdF0T1STATA6PJtqNl0q1Zoeg1W\\n8Uz+4DtzrQKBgQC9/7R7pSopsIYgj37oxVWSxrXDOD1QR97s+yWPv5oQSNn5xcNm\\n6E+T5mcpzTP2V+oyAulmeRHeuerAYRHjaEPq6IYAJqCvaL6DdGCHXItze4oLnQTW\\nnIYHNFQwpjtz1gqlNzAjOKFtGG/6KV60Zde/eL06Z+Do4kKYcVItQTa0ywKBgQCX\\nK3ewGiakz8PxIL4l576K30jdqfSOn5ok7wyOMPygHIPI7LZRIZWLaOwhektgxRrp\\nTFDjnCe5GOVtELm54NxXqX4LTGg9KeHE6kgcOkm92q4wolY7TFGq8cr9spMHj89m\\ndHVTapSquyxZ1HcoLUOi74WQLJrUmf72pfT1+B1aFQKBgQCvBEQWilU0a3TE6MAp\\n2gpmcZS9Qm32QRvgRDlodDox4+fPDc6CQ8J0FD/kbOl80DJup+Ye071AtN/MjKSw\\nsYKDQ4ZWuELZRRDCkftCmsK6tLPEuOME1KvSZ5FXuZjeecZE4xpJPBU4anDRb28o\\n8wkJ3VJI9JA66Fr3bNDHNxdNEw==\\n-----END PRIVATE KEY-----";

        JwtConfig jwtConfig = new JwtConfig();
        ReflectionTestUtils.setField(jwtConfig, "privateKey", privateKeyWithEscapedNewlines);

        // when & then - should not throw exception
        assertDoesNotThrow(jwtConfig::privateKey);
    }
}
