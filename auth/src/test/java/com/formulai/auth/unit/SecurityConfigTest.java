package com.formulai.auth.unit;

import com.formulai.auth.config.JwtTokenFilter;
import com.formulai.auth.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SecurityConfigTest {

    @InjectMocks
    private SecurityConfig securityConfig;

    @Test
    void shouldCreateBcryptPasswordEncoder() {
        // when
        PasswordEncoder encoder = securityConfig.passwordEncoder();

        // then
        assertNotNull(encoder);
        String password = "testpassword";
        String encoded = encoder.encode(password);

        // weryfikacja, że kodowanie działa poprawnie
        assertNotEquals(password, encoded);
        assertTrue(encoder.matches(password, encoded));
        assertFalse(encoder.matches("wrongpassword", encoded));
    }

    @Test
    void shouldConfigureFilterChain() throws Exception {
        // given
        HttpSecurity http = mock(HttpSecurity.class);
        JwtTokenFilter jwtTokenFilter = mock(JwtTokenFilter.class);

        // Mockowanie łańcucha wywołań HttpSecurity
        when(http.csrf(any())).thenReturn(http);
        when(http.sessionManagement(any())).thenReturn(http);
        when(http.authorizeHttpRequests(any())).thenReturn(http);
        when(http.addFilterBefore(any(), any())).thenReturn(http);

        SecurityFilterChain mockChain = mock(SecurityFilterChain.class);
        doReturn(mockChain).when(http).build();
        // when
        SecurityFilterChain filterChain = securityConfig.filterChain(http, jwtTokenFilter);

        // then
        assertNotNull(filterChain);
        assertEquals(mockChain, filterChain);

        // weryfikacja, że filtr JWT został dodany
        verify(http).addFilterBefore(jwtTokenFilter, UsernamePasswordAuthenticationFilter.class);
    }
}
