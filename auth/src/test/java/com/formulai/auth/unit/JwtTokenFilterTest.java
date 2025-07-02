package com.formulai.auth.unit;

import com.formulai.auth.config.JwtTokenFilter;
import com.formulai.auth.enums.Roles;
import com.formulai.auth.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class JwtTokenFilterTest {
    @Mock
    private JwtService jwtService;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private FilterChain filterChain;
    @InjectMocks
    private JwtTokenFilter jwtTokenFilter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldProcessValidJwtTokenWithAuthRole() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of(Roles.ROLE_AUTHOR.getRoleName());

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(email, auth.getPrincipal());
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority(Roles.ROLE_AUTHOR.getRoleName())));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldProcessValidJwtTokenWithPublicRole() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "public@public.com";
        Set<String> roles = Set.of(Roles.ROLE_PUBLIC.getRoleName());

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(email, auth.getPrincipal());
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority(Roles.ROLE_PUBLIC.getRoleName())));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldProcessJwtTokenWithMultipleRoles() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "public@author.com";
        Set<String> roles = Set.of(Roles.ROLE_PUBLIC.getRoleName(), Roles.ROLE_AUTHOR.getRoleName());

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(email, auth.getPrincipal());
        assertEquals(2, auth.getAuthorities().size());
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority(Roles.ROLE_PUBLIC.getRoleName())));
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority(Roles.ROLE_AUTHOR.getRoleName())));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldAddRolePrefixWhenMissing() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of("AUTHOR");

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(email, auth.getPrincipal());
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_AUTHOR")));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldNotAddRolePrefixWhenAlreadyPresent() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of("ROLE_AUTHOR");

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_AUTHOR")));
        assertFalse(auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ROLE_AUTHOR")));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldSkipFilterWhenNoAuthorizationHeader() throws ServletException, IOException {
        //given
        when(request.getHeader("Authorization")).thenReturn(null);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNull(auth);
        verify(jwtService, never()).extractEmail(anyString());
    }

    @Test
    void shouldSkipFilterWhenAuthorizationHeaderDoesNotStartWithBearer() throws ServletException, IOException {
        //given
        when(request.getHeader("Authorization")).thenReturn("Basic sometoken");

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
        verify(jwtService, never()).extractEmail(anyString());
    }

    @Test
    void shouldNotSetAuthenticationWhenTokenIsInvalid() throws ServletException, IOException {
        // given
        String token = "invalid.jwt";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn("user@test.com");
        when(jwtService.extractRoles(token)).thenReturn(Set.of("ROLE_AUTHOR"));
        when(jwtService.isTokenValid(token)).thenReturn(false);

        // when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        // then
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldNotSetAuthenticationWhenEmailIsNull() throws ServletException, IOException {
        // given
        String token = "valid.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(null);
        when(jwtService.extractRoles(token)).thenReturn(Set.of("ROLE_AUTHOR"));

        // when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        // then
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldHandleExceptionDuringTokenProcessing() throws ServletException, IOException {
        // given
        String token = "valid.jwt";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenThrow(new RuntimeException("Token processing error"));

        // when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        // then
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldNotOverrideExistingAuthentication() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of(Roles.ROLE_AUTHOR.getRoleName());

        Authentication existingAuth = mock(Authentication.class);
        SecurityContextHolder.getContext().setAuthentication(existingAuth);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        assertEquals(existingAuth, SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldHabdleEmptyRolesSet() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of();

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(email, auth.getPrincipal());
        assertTrue(auth.getAuthorities().isEmpty());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldHandleNullRolesSet() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        // Symulujemy, że jwtService.extractRoles rzuca RuntimeException
        when(jwtService.extractRoles(token)).thenThrow(new RuntimeException("Null roles set"));


        //when
        assertDoesNotThrow(() -> jwtTokenFilter.doFilterInternal(request, response, filterChain));

        //then
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldSetWebAuthenticationDetails() throws ServletException, IOException {
        //given
        String token = "valid.jwt";
        String email = "author@author.com";
        Set<String> roles = Set.of(Roles.ROLE_AUTHOR.getRoleName());

        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtService.extractEmail(token)).thenReturn(email);
        when(jwtService.extractRoles(token)).thenReturn(roles);
        when(jwtService.isTokenValid(token)).thenReturn(true);

        //when
        jwtTokenFilter.doFilterInternal(request, response, filterChain);

        //then
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertNotNull(auth.getDetails());
        verify(filterChain).doFilter(request, response);
    }
}
