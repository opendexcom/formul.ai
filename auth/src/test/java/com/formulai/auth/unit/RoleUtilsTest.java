package com.formulai.auth.unit;

import com.formulai.auth.enums.Roles;
import com.formulai.auth.model.UserRole;
import com.formulai.auth.util.RoleUtils;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class RoleUtilsTest {

    @Test
    void shouldExtractRoleNames() {
        // given
        Set<UserRole> userRoles = Set.of(
                UserRole.builder().id(UUID.randomUUID()).name("ROLE_AUTHOR").build(),
                UserRole.builder().id(UUID.randomUUID()).name("ROLE_PUBLIC").build()
        );

        // when
        Set<String> roleNames = RoleUtils.extractRoleNames(userRoles);

        // then
        assertEquals(2, roleNames.size());
        assertTrue(roleNames.contains("ROLE_AUTHOR"));
        assertTrue(roleNames.contains("ROLE_PUBLIC"));
    }

    @Test
    void shouldExtractRoleNamesFromEmptySet() {
        // given
        Set<UserRole> userRoles = new HashSet<>();

        // when
        Set<String> roleNames = RoleUtils.extractRoleNames(userRoles);

        // then
        assertTrue(roleNames.isEmpty());
    }

    @Test
    void shouldIdentifyAuthorRole() {
        // given
        Set<String> roleNames = Set.of(Roles.ROLE_AUTHOR.getRoleName(), "ROLE_OTHER");

        // when & then
        assertTrue(RoleUtils.hasAuthorRole(roleNames));
    }

    @Test
    void shouldReturnFalseWhenNoAuthorRole() {
        // given
        Set<String> roleNames = Set.of("ROLE_OTHER", Roles.ROLE_PUBLIC.getRoleName());

        // when & then
        assertFalse(RoleUtils.hasAuthorRole(roleNames));
    }

    @Test
    void shouldIdentifyPublicRole() {
        // given
        Set<String> roleNames = Set.of("ROLE_OTHER", Roles.ROLE_PUBLIC.getRoleName());

        // when & then
        assertTrue(RoleUtils.hasPublicRole(roleNames));
    }

    @Test
    void shouldReturnFalseWhenNoPublicRole() {
        // given
        Set<String> roleNames = Set.of(Roles.ROLE_AUTHOR.getRoleName(), "ROLE_OTHER");

        // when & then
        assertFalse(RoleUtils.hasPublicRole(roleNames));
    }

    @Test
    void shouldGetDisplayNameByRemovingRolePrefix() {
        // given
        String roleName = "ROLE_AUTHOR";

        // when
        String displayName = RoleUtils.getDisplayName(roleName);

        // then
        assertEquals("AUTHOR", displayName);
    }

    @Test
    void shouldReturnOriginalStringWhenNoPrefixPresent() {
        // given
        String roleName = "AUTHOR";

        // when
        String displayName = RoleUtils.getDisplayName(roleName);

        // then
        assertEquals("AUTHOR", displayName);
    }
}
