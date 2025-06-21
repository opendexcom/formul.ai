package com.formulai.auth.util;

import com.formulai.auth.enums.Roles;
import com.formulai.auth.model.UserRole;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Utility class for role operations
 */
public class RoleUtils {
    private RoleUtils() {}

    /**
     * Converts UserRole entities to role name strings
     *
     * @param userRoles set of UserRole entities
     * @return set of role name strings
     */
    public static Set<String> extractRoleNames(Set<UserRole> userRoles) {
        return userRoles.stream()
                .map(UserRole::getName)
                .collect(Collectors.toSet());
    }

    /**
     * Checks if a set of roles contains the AUTHOR role
     *
     * @param roleNames set of role name strings
     * @return true if AUTHOR role is present
     */
    public static boolean hasAuthorRole(Set<String> roleNames) {
        return roleNames.contains(Roles.ROLE_AUTHOR.getRoleName());
    }

    /**
     * Checks if a set of roles contains the PUBLIC role
     *
     * @param roleNames set of role name strings
     * @return true if PUBLIC role is present
     */
    public static boolean hasPublicRole(Set<String> roleNames) {
        return roleNames.contains(Roles.ROLE_PUBLIC.getRoleName());
    }

    /**
     * Gets the display name for a role (without ROLE_ prefix)
     *
     * @param roleName full role name (e.g., "ROLE_AUTHOR")
     * @return display name (e.g., "AUTHOR")
     */
    public static String getDisplayName(String roleName) {
        if (roleName.startsWith("ROLE_")) {
            return roleName.substring(5);
        }
        return roleName;
    }


}
