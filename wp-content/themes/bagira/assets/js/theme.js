( function () {
	'use strict';

	var fields = document.querySelectorAll( '.form-field input' );

	document.addEventListener( 'click', function ( event ) {
		var hash = String.fromCharCode( 35 );
		var popupPrefix = hash + 'popup-';
		var selector = 'a[href^="' + popupPrefix + '"]';
		var link = event.target.closest ? event.target.closest( selector ) : null;

		if ( ! link ) {
			return;
		}

		var href = link.getAttribute( 'href' ) || '';

		if ( href.indexOf( popupPrefix ) !== 0 ) {
			return;
		}

		var idPart = href.slice( popupPrefix.length );

		if ( ! /^\d+$/.test( idPart ) ) {
			return;
		}

		var popupId = Number( idPart );

		if ( ! Number.isFinite( popupId ) || popupId <= 0 || typeof window.LP_show !== 'function' ) {
			return;
		}

		event.preventDefault();
		window.LP_show( popupId );
	} );

	function updateFieldState( field ) {
		field.classList.toggle( 'has-value', field.value.trim() !== '' );
	}

	fields.forEach( function ( field ) {
		updateFieldState( field );
		field.addEventListener( 'input', function () {
			updateFieldState( field );
		} );
		field.addEventListener( 'change', function () {
			updateFieldState( field );
		} );
	} );

	document.querySelectorAll( '.service-equipment__flip-toggle' ).forEach( function ( toggle ) {
		toggle.addEventListener( 'click', function () {
			var card = toggle.closest( '.service-equipment__item' );

			if ( ! card ) {
				return;
			}

			var flipped = card.classList.toggle( 'is-flipped' );

			toggle.setAttribute( 'aria-pressed', String( flipped ) );
			toggle.setAttribute( 'aria-label', flipped ? toggle.dataset.hideLabel : toggle.dataset.showLabel );
		} );
	} );

	document.querySelectorAll( '.service-equipment__more' ).forEach( function ( button ) {
		var grid = button.previousElementSibling;

		if ( ! grid || ! grid.classList.contains( 'service-equipment__grid--collapsible' ) ) {
			return;
		}

		grid.classList.add( 'is-collapsed' );
		button.addEventListener( 'click', function () {
			var expanded = button.getAttribute( 'aria-expanded' ) !== 'true';

			grid.classList.toggle( 'is-collapsed', ! expanded );
			button.setAttribute( 'aria-expanded', String( expanded ) );
			button.textContent = expanded ? button.dataset.lessLabel : button.dataset.moreLabel;
		} );
	} );

    /* Mobile highlights: match carousel height to the visible card on smartphone-alarm pages. */
    if ( document.querySelector( '.service-application--smartphone-alarm' ) ) {
        document.querySelectorAll( '.service-hero__highlights' ).forEach( function ( list ) {
            var items = Array.prototype.slice.call( list.children );
            var timer;

            if ( ! items.length ) {
                return;
            }

            function updateHighlightsHeight() {
                if ( ! window.matchMedia( '(max-width: 767px)' ).matches ) {
                    list.style.removeProperty( 'height' );
                    return;
                }

                var listRect = list.getBoundingClientRect();
                var styles = window.getComputedStyle( list );
                var paddingLeft = parseFloat( styles.paddingLeft ) || 0;
                var paddingTop = parseFloat( styles.paddingTop ) || 0;
                var paddingBottom = parseFloat( styles.paddingBottom ) || 0;
                var targetLeft = listRect.left + paddingLeft;

                var active = items.reduce( function ( best, item ) {
                    var distance = Math.abs( item.getBoundingClientRect().left - targetLeft );
                    var bestDistance = Math.abs( best.getBoundingClientRect().left - targetLeft );

                    return distance < bestDistance ? item : best;
                } );

                var height = active.getBoundingClientRect().height + paddingTop + paddingBottom;

                list.style.setProperty( 'height', Math.ceil( height ) + 'px' );
            }

            list.addEventListener( 'scroll', function () {
                window.clearTimeout( timer );
                timer = window.setTimeout( updateHighlightsHeight, 80 );
            } );

            window.addEventListener( 'resize', updateHighlightsHeight );

            updateHighlightsHeight();
        } );
    }

}() );
